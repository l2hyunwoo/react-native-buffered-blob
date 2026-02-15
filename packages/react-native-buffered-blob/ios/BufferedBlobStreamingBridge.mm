#import "BufferedBlobStreamingBridge.h"
#import "BufferedBlobStreamingHostObject.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>

// Forward declarations for Swift classes accessible via bridging header
@class ReaderHandleIOS;
@class WriterHandleIOS;
@class DownloaderHandleIOS;
@class HandleRegistry;

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

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      @autoreleasepool {
        HandleRegistry *registry = [HandleRegistry shared];
        ReaderHandleIOS *reader = [registry get:handleId];

        if (!reader) {
          onError("[READER_CLOSED] Reader handle not found");
          return;
        }

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

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      @autoreleasepool {
        HandleRegistry *registry = [HandleRegistry shared];
        WriterHandleIOS *writer = [registry get:handleId];

        if (!writer) {
          onError("[WRITER_CLOSED] Writer handle not found");
          return;
        }

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

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      @autoreleasepool {
        HandleRegistry *registry = [HandleRegistry shared];
        WriterHandleIOS *writer = [registry get:handleId];

        if (!writer) {
          onError("[WRITER_CLOSED] Writer handle not found");
          return;
        }

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

    NSURLSession *session = [NSURLSession sharedSession];
    NSURLSessionDataTask *task = [session dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      if (handle.isCancelled) {
        onError("[DOWNLOAD_CANCELLED] Download was cancelled");
        return;
      }

      if (error) {
        onError(std::string("[DOWNLOAD_FAILED] ") +
                [error.localizedDescription UTF8String]);
        return;
      }

      NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
      if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
        onError(std::string("[DOWNLOAD_FAILED] HTTP ") +
                std::to_string(httpResponse.statusCode));
        return;
      }

      if (!data) {
        onError("[DOWNLOAD_FAILED] Empty response body");
        return;
      }

      NSString *destPath = [NSString stringWithUTF8String:handle.destPath.UTF8String];
      NSString *parentDir = [destPath stringByDeletingLastPathComponent];
      [[NSFileManager defaultManager] createDirectoryAtPath:parentDir
                                withIntermediateDirectories:YES
                                                attributes:nil
                                                     error:nil];

      NSError *writeError = nil;
      BOOL success = [data writeToFile:destPath options:NSDataWritingAtomic error:&writeError];

      if (!success || writeError) {
        onError(std::string("[IO_ERROR] Failed to write file: ") +
                (writeError ? [writeError.localizedDescription UTF8String] : "unknown"));
        return;
      }

      onProgress(static_cast<double>(data.length),
                 static_cast<double>(data.length), 1.0);
      onSuccess();
    }];

    [task resume];
  }

  void cancelDownload(int handleId) override {
    HandleRegistry *registry = [HandleRegistry shared];
    DownloaderHandleIOS *handle = [registry get:handleId];
    if (handle) {
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
