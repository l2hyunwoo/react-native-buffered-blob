#import "BufferedBlobStreamingBridge.h"
#import "BufferedBlobStreamingHostObject.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>

// Forward declarations for Swift classes accessible via bridging header
@class ReaderHandleIOS;
@class WriterHandleIOS;
@class DownloaderHandleIOS;
@class HandleRegistry;

@interface DownloadSessionDelegate : NSObject <NSURLSessionDataDelegate>
@property (nonatomic, copy) NSString *destPath;
@property (nonatomic, strong) NSOutputStream *outputStream;
@property (nonatomic, assign) int64_t totalBytes;
@property (nonatomic, assign) int64_t downloadedBytes;
@property (nonatomic, assign) BOOL isFinished;
@property (nonatomic, weak) DownloaderHandleIOS *handle;
@property (nonatomic, copy) void (^onProgress)(double, double, double);
@property (nonatomic, copy) void (^onSuccess)(void);
@property (nonatomic, copy) void (^onError)(NSString *);
@end

@implementation DownloadSessionDelegate

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler {
  if (self.isFinished) return;

  if (self.handle.isCancelled) {
    self.isFinished = YES;
    completionHandler(NSURLSessionResponseCancel);
    if (self.onError) {
      self.onError(@"[DOWNLOAD_CANCELLED] Download was cancelled");
    }
    return;
  }

  NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
  if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
    self.isFinished = YES;
    completionHandler(NSURLSessionResponseCancel);
    if (self.onError) {
      NSString *errorMsg = [NSString stringWithFormat:@"[DOWNLOAD_FAILED] HTTP %ld",
                            (long)httpResponse.statusCode];
      self.onError(errorMsg);
    }
    return;
  }

  self.totalBytes = response.expectedContentLength;
  self.downloadedBytes = 0;

  // Open output stream
  self.outputStream = [NSOutputStream outputStreamToFileAtPath:self.destPath append:NO];
  [self.outputStream open];

  if (self.outputStream.streamStatus == NSStreamStatusError) {
    self.isFinished = YES;
    completionHandler(NSURLSessionResponseCancel);
    if (self.onError) {
      self.onError(@"[IO_ERROR] Failed to open output stream");
    }
    return;
  }

  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
  if (self.isFinished) return;

  if (self.handle.isCancelled) {
    self.isFinished = YES;
    [session invalidateAndCancel];
    if (self.onError) {
      self.onError(@"[DOWNLOAD_CANCELLED] Download was cancelled");
    }
    return;
  }

  if (!self.outputStream || self.outputStream.streamStatus != NSStreamStatusOpen) {
    self.isFinished = YES;
    [session invalidateAndCancel];
    if (self.onError) {
      self.onError(@"[IO_ERROR] Output stream not open");
    }
    return;
  }

  const uint8_t *bytes = (const uint8_t *)data.bytes;
  NSUInteger length = data.length;
  NSUInteger totalWritten = 0;

  while (totalWritten < length) {
    NSInteger written = [self.outputStream write:(bytes + totalWritten)
                                       maxLength:(length - totalWritten)];
    if (written < 0) {
      self.isFinished = YES;
      [session invalidateAndCancel];
      if (self.onError) {
        self.onError(@"[IO_ERROR] Failed to write to file");
      }
      return;
    }
    totalWritten += written;
  }

  self.downloadedBytes += length;

  if (self.onProgress && self.totalBytes > 0) {
    double progress = (double)self.downloadedBytes / (double)self.totalBytes;
    self.onProgress((double)self.downloadedBytes, (double)self.totalBytes, progress);
  }
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
didCompleteWithError:(NSError *)error {
  if (self.outputStream) {
    [self.outputStream close];
    self.outputStream = nil;
  }

  if (self.isFinished) return;
  self.isFinished = YES;

  if (self.handle.isCancelled) {
    if (self.onError) {
      self.onError(@"[DOWNLOAD_CANCELLED] Download was cancelled");
    }
    return;
  }

  if (error) {
    if (self.onError) {
      NSString *errorMsg = [NSString stringWithFormat:@"[DOWNLOAD_FAILED] %@",
                            error.localizedDescription];
      self.onError(errorMsg);
    }
    return;
  }

  if (self.onSuccess) {
    self.onSuccess();
  }
}

@end

namespace {

using namespace bufferedblob;

/**
 * iOS implementation of PlatformBridge.
 * Calls into Swift HandleRegistry and handle types via ObjC interop.
 */
class IOSPlatformBridge : public PlatformBridge {
public:
  IOSPlatformBridge() {}

  void readNextChunk(
      int handleId,
      std::function<void(std::vector<uint8_t>)> onSuccess,
      std::function<void()> onEOF,
      std::function<void(std::string)> onError) override {

    HandleRegistry *registry = [HandleRegistry shared];
    ReaderHandleIOS *reader = [registry get:handleId];

    if (!reader) {
      onError("[READER_CLOSED] Reader handle not found");
      return;
    }

    // Dispatch to the reader's serial queue to serialize all access to this handle
    dispatch_async(reader.queue, ^{
      @autoreleasepool {
        if (reader.isClosed) {
          onError("[READER_CLOSED] Reader is closed");
          return;
        }

        if (reader.isEOF) {
          onEOF();
          return;
        }

        NSInteger bufferSize = reader.bufferSize;
        uint8_t *buffer = (uint8_t *)malloc(bufferSize);
        if (!buffer) {
          onError("[IO_ERROR] Failed to allocate read buffer");
          return;
        }

        NSInteger bytesRead = [reader.inputStream read:buffer maxLength:bufferSize];

        if (bytesRead < 0) {
          free(buffer);
          onError("[IO_ERROR] Read error");
          return;
        }

        if (bytesRead == 0) {
          free(buffer);
          reader.isEOF = YES;
          onEOF();
          return;
        }

        reader.bytesRead += bytesRead;

        std::vector<uint8_t> data(buffer, buffer + bytesRead);
        free(buffer);
        onSuccess(std::move(data));
      }
    });
  }

  void write(
      int handleId,
      const uint8_t *data,
      size_t size,
      std::function<void(int)> onSuccess,
      std::function<void(std::string)> onError) override {

    // Copy the data before dispatching
    std::vector<uint8_t> dataCopy(data, data + size);

    HandleRegistry *registry = [HandleRegistry shared];
    WriterHandleIOS *writer = [registry get:handleId];

    if (!writer) {
      onError("[WRITER_CLOSED] Writer handle not found");
      return;
    }

    // Dispatch to the writer's serial queue to serialize all access to this handle
    dispatch_async(writer.queue, ^{
      @autoreleasepool {
        if (writer.isClosed) {
          onError("[WRITER_CLOSED] Writer is closed");
          return;
        }

        NSInteger totalWritten = 0;
        const uint8_t *ptr = dataCopy.data();
        NSInteger remaining = static_cast<NSInteger>(dataCopy.size());

        while (remaining > 0) {
          NSInteger written = [writer.outputStream write:ptr maxLength:remaining];
          if (written < 0) {
            onError("[IO_ERROR] Write error");
            return;
          }
          if (written == 0) {
            onError("[IO_ERROR] Write returned 0 bytes");
            return;
          }
          totalWritten += written;
          ptr += written;
          remaining -= written;
        }

        writer.bytesWritten += totalWritten;
        onSuccess(static_cast<int>(totalWritten));
      }
    });
  }

  void flush(
      int handleId,
      std::function<void()> onSuccess,
      std::function<void(std::string)> onError) override {

    HandleRegistry *registry = [HandleRegistry shared];
    WriterHandleIOS *writer = [registry get:handleId];

    if (!writer) {
      onError("[WRITER_CLOSED] Writer handle not found");
      return;
    }

    // Dispatch to the writer's serial queue to serialize all access to this handle
    dispatch_async(writer.queue, ^{
      @autoreleasepool {
        if (writer.isClosed) {
          onError("[WRITER_CLOSED] Writer is closed");
          return;
        }

        // NSOutputStream doesn't have an explicit flush, data is written immediately
        onSuccess();
      }
    });
  }

  void close(int handleId) override {
    HandleRegistry *registry = [HandleRegistry shared];
    [registry remove:handleId];
  }

  void startDownload(
      int handleId,
      std::function<void(double, double, double)> onProgress,
      std::function<void()> onSuccess,
      std::function<void(std::string)> onError) override {

    HandleRegistry *registry = [HandleRegistry shared];
    DownloaderHandleIOS *handle = [registry get:handleId];

    if (!handle) {
      onError("[DOWNLOAD_FAILED] Download handle not found");
      return;
    }

    if (handle.isCancelled) {
      onError("[DOWNLOAD_CANCELLED] Download was cancelled");
      return;
    }

    NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:handle.url.UTF8String]];
    if (!url) {
      onError("[DOWNLOAD_FAILED] Invalid URL");
      return;
    }

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    for (NSString *key in handle.headers) {
      [request setValue:handle.headers[key] forHTTPHeaderField:key];
    }

    NSString *destPath = [NSString stringWithUTF8String:handle.destPath.UTF8String];
    NSString *parentDir = [destPath stringByDeletingLastPathComponent];
    [[NSFileManager defaultManager] createDirectoryAtPath:parentDir
                                withIntermediateDirectories:YES
                                                attributes:nil
                                                     error:nil];

    DownloadSessionDelegate *delegate = [[DownloadSessionDelegate alloc] init];
    delegate.destPath = destPath;
    delegate.handle = handle;
    delegate.onProgress = ^(double downloaded, double total, double progress) {
      onProgress(downloaded, total, progress);
    };
    delegate.onSuccess = ^{
      onSuccess();
    };
    delegate.onError = ^(NSString *errorMsg) {
      onError(std::string([errorMsg UTF8String]));
    };

    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    NSURLSession *session = [NSURLSession sessionWithConfiguration:config
                                                          delegate:delegate
                                                     delegateQueue:nil];
    NSURLSessionDataTask *task = [session dataTaskWithRequest:request];

    // Store session and task on the handle so cancelDownload can properly invalidate
    [handle storeSession:session task:task];

    [task resume];
  }

  void cancelDownload(int handleId) override {
    HandleRegistry *registry = [HandleRegistry shared];
    DownloaderHandleIOS *handle = [registry get:handleId];
    if (handle) {
      // cancel() now properly invalidates the NSURLSession and task
      [handle cancel];
    }
  }

  ReaderInfo getReaderInfo(int handleId) override {
    ReaderInfo info{0, 0, false};
    HandleRegistry *registry = [HandleRegistry shared];
    ReaderHandleIOS *reader = [registry get:handleId];
    if (reader) {
      info.fileSize = static_cast<double>(reader.fileSize);
      info.bytesRead = static_cast<double>(reader.bytesRead);
      info.isEOF = reader.isEOF;
    }
    return info;
  }

  WriterInfo getWriterInfo(int handleId) override {
    WriterInfo info{0};
    HandleRegistry *registry = [HandleRegistry shared];
    WriterHandleIOS *writer = [registry get:handleId];
    if (writer) {
      info.bytesWritten = static_cast<double>(writer.bytesWritten);
    }
    return info;
  }
};

} // anonymous namespace

void installBufferedBlobStreaming(
    facebook::jsi::Runtime& runtime,
    std::shared_ptr<facebook::react::CallInvoker> callInvoker) {
  auto bridge = std::make_shared<IOSPlatformBridge>();
  bufferedblob::BufferedBlobStreamingHostObject::install(
      runtime, std::move(callInvoker), std::move(bridge));
}
