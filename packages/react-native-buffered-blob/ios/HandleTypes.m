#import "HandleTypes.h"

// ──────────────────────────────────────────────────────────────────────
#pragma mark - ReaderHandleIOS
// ──────────────────────────────────────────────────────────────────────

@implementation ReaderHandleIOS {
  NSLock *_lock;
  int64_t _bytesReadBacking;
  BOOL _isEOFBacking;
  BOOL _isClosedBacking;
}

static NSInteger _readerNextId = 0;
static NSLock *_readerIdLock = nil;

+ (void)initialize {
  if (self == [ReaderHandleIOS class]) {
    _readerIdLock = [NSLock new];
  }
}

+ (NSInteger)nextUniqueId {
  [_readerIdLock lock];
  NSInteger uid = ++_readerNextId;
  [_readerIdLock unlock];
  return uid;
}

- (nullable instancetype)initWithPath:(NSString *)path
                           bufferSize:(NSInteger)bufferSize
                                error:(NSError **)error {
  self = [super init];
  if (!self) return nil;

  NSInputStream *stream = [NSInputStream inputStreamWithFileAtPath:path];
  if (!stream) {
    if (error) {
      *error = [NSError errorWithDomain:@"BufferedBlob" code:1
                               userInfo:@{NSLocalizedDescriptionKey:
                                            [NSString stringWithFormat:@"[FILE_NOT_FOUND] Could not open file: %@", path]}];
    }
    return nil;
  }

  _inputStream = stream;
  _bufferSize = bufferSize;
  _lock = [NSLock new];
  _bytesReadBacking = 0;
  _isEOFBacking = NO;
  _isClosedBacking = NO;

  NSString *label = [NSString stringWithFormat:@"com.bufferedblob.reader.%ld", (long)[ReaderHandleIOS nextUniqueId]];
  _queue = dispatch_queue_create(label.UTF8String, DISPATCH_QUEUE_SERIAL);
  dispatch_set_target_queue(_queue, dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0));

  // Get file size
  NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:error];
  if (!attrs) return nil;
  _fileSize = [attrs[NSFileSize] longLongValue];

  [stream open];
  if (stream.streamStatus == NSStreamStatusError) {
    [stream close];
    if (error) {
      *error = [NSError errorWithDomain:@"BufferedBlob" code:1
                               userInfo:@{NSLocalizedDescriptionKey:
                                            [NSString stringWithFormat:@"[FILE_NOT_FOUND] Failed to open stream: %@", path]}];
    }
    return nil;
  }

  return self;
}

- (int64_t)bytesRead {
  [_lock lock];
  int64_t val = _bytesReadBacking;
  [_lock unlock];
  return val;
}

- (void)setBytesRead:(int64_t)bytesRead {
  [_lock lock];
  _bytesReadBacking = bytesRead;
  [_lock unlock];
}

- (BOOL)isEOF {
  [_lock lock];
  BOOL val = _isEOFBacking;
  [_lock unlock];
  return val;
}

- (void)setIsEOF:(BOOL)isEOF {
  [_lock lock];
  _isEOFBacking = isEOF;
  [_lock unlock];
}

- (BOOL)isClosed {
  [_lock lock];
  BOOL val = _isClosedBacking;
  [_lock unlock];
  return val;
}

- (void)setIsClosed:(BOOL)isClosed {
  [_lock lock];
  _isClosedBacking = isClosed;
  [_lock unlock];
}

- (void)closeHandle {
  [_lock lock];
  if (_isClosedBacking) {
    [_lock unlock];
    return;
  }
  _isClosedBacking = YES;
  NSInputStream *stream = _inputStream;
  [_lock unlock];
  // Dispatch stream close to the serial queue so it runs AFTER
  // all pending I/O blocks have drained.
  dispatch_async(_queue, ^{
    [stream close];
  });
}

- (void)dealloc {
  [self closeHandle];
}

@end

// ──────────────────────────────────────────────────────────────────────
#pragma mark - WriterHandleIOS
// ──────────────────────────────────────────────────────────────────────

@implementation WriterHandleIOS {
  NSLock *_lock;
  int64_t _bytesWrittenBacking;
  BOOL _isClosedBacking;
}

static NSInteger _writerNextId = 0;
static NSLock *_writerIdLock = nil;

+ (void)initialize {
  if (self == [WriterHandleIOS class]) {
    _writerIdLock = [NSLock new];
  }
}

+ (NSInteger)nextUniqueId {
  [_writerIdLock lock];
  NSInteger uid = ++_writerNextId;
  [_writerIdLock unlock];
  return uid;
}

- (nullable instancetype)initWithPath:(NSString *)path
                               append:(BOOL)append
                                error:(NSError **)error {
  self = [super init];
  if (!self) return nil;

  NSOutputStream *stream = [NSOutputStream outputStreamToFileAtPath:path append:append];
  if (!stream) {
    if (error) {
      *error = [NSError errorWithDomain:@"BufferedBlob" code:1
                               userInfo:@{NSLocalizedDescriptionKey:
                                            [NSString stringWithFormat:@"[FILE_NOT_FOUND] Could not open file for writing: %@", path]}];
    }
    return nil;
  }

  _outputStream = stream;
  _lock = [NSLock new];
  _bytesWrittenBacking = 0;
  _isClosedBacking = NO;

  NSString *label = [NSString stringWithFormat:@"com.bufferedblob.writer.%ld", (long)[WriterHandleIOS nextUniqueId]];
  _queue = dispatch_queue_create(label.UTF8String, DISPATCH_QUEUE_SERIAL);
  dispatch_set_target_queue(_queue, dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0));

  [stream open];
  if (stream.streamStatus == NSStreamStatusError) {
    [stream close];
    if (error) {
      *error = [NSError errorWithDomain:@"BufferedBlob" code:1
                               userInfo:@{NSLocalizedDescriptionKey:
                                            [NSString stringWithFormat:@"[FILE_NOT_FOUND] Failed to open write stream: %@", path]}];
    }
    return nil;
  }

  return self;
}

- (int64_t)bytesWritten {
  [_lock lock];
  int64_t val = _bytesWrittenBacking;
  [_lock unlock];
  return val;
}

- (void)setBytesWritten:(int64_t)bytesWritten {
  [_lock lock];
  _bytesWrittenBacking = bytesWritten;
  [_lock unlock];
}

- (BOOL)isClosed {
  [_lock lock];
  BOOL val = _isClosedBacking;
  [_lock unlock];
  return val;
}

- (void)setIsClosed:(BOOL)isClosed {
  [_lock lock];
  _isClosedBacking = isClosed;
  [_lock unlock];
}

- (void)closeHandle {
  [_lock lock];
  if (_isClosedBacking) {
    [_lock unlock];
    return;
  }
  _isClosedBacking = YES;
  NSOutputStream *stream = _outputStream;
  [_lock unlock];
  dispatch_async(_queue, ^{
    [stream close];
  });
}

- (void)dealloc {
  [self closeHandle];
}

@end

// ──────────────────────────────────────────────────────────────────────
#pragma mark - DownloaderHandleIOS
// ──────────────────────────────────────────────────────────────────────

@implementation DownloaderHandleIOS {
  NSLock *_lock;
  BOOL _isCancelledBacking;
  NSURLSession *_session;
  NSURLSessionTask *_task;
}

static NSInteger _downloaderNextId = 0;
static NSLock *_downloaderIdLock = nil;

+ (void)initialize {
  if (self == [DownloaderHandleIOS class]) {
    _downloaderIdLock = [NSLock new];
  }
}

+ (NSInteger)nextUniqueId {
  [_downloaderIdLock lock];
  NSInteger uid = ++_downloaderNextId;
  [_downloaderIdLock unlock];
  return uid;
}

- (instancetype)initWithURL:(NSString *)url
                   destPath:(NSString *)destPath
                    headers:(NSDictionary<NSString *, NSString *> *)headers {
  self = [super init];
  if (self) {
    _url = [url copy];
    _destPath = [destPath copy];
    _headers = [headers copy];
    _lock = [NSLock new];
    _isCancelledBacking = NO;

    NSString *label = [NSString stringWithFormat:@"com.bufferedblob.downloader.%ld", (long)[DownloaderHandleIOS nextUniqueId]];
    _queue = dispatch_queue_create(label.UTF8String, DISPATCH_QUEUE_SERIAL);
    dispatch_set_target_queue(_queue, dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0));
  }
  return self;
}

- (BOOL)isCancelled {
  [_lock lock];
  BOOL val = _isCancelledBacking;
  [_lock unlock];
  return val;
}

- (void)setIsCancelled:(BOOL)isCancelled {
  [_lock lock];
  _isCancelledBacking = isCancelled;
  [_lock unlock];
}

- (void)storeSession:(NSURLSession *)session task:(NSURLSessionTask *)task {
  [_lock lock];
  _session = session;
  _task = task;
  [_lock unlock];
}

- (void)cancel {
  [_lock lock];
  if (_isCancelledBacking) {
    [_lock unlock];
    return;
  }
  _isCancelledBacking = YES;
  NSURLSession *session = _session;
  NSURLSessionTask *task = _task;
  [_lock unlock];

  // Cancel outside the lock to avoid potential deadlock with delegate callbacks
  [task cancel];
  [session invalidateAndCancel];
}

- (void)closeHandle {
  [self cancel];
}

@end
