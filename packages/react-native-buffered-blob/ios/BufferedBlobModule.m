#import "BufferedBlobModule.h"
#import "HandleRegistry.h"
#import "HandleTypes.h"
#import <CommonCrypto/CommonDigest.h>

@implementation BufferedBlobModule

+ (NSString *)moduleName {
  return @"BufferedBlob";
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSDictionary *)constantsToExport {
  NSArray<NSString *> *docPaths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *docDir = docPaths.firstObject ?: @"";

  NSArray<NSString *> *cachePaths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *cacheDir = cachePaths.firstObject ?: @"";

  NSString *tempDir = NSTemporaryDirectory();

  NSString *downloadDir = docDir;
  if (@available(iOS 16.0, *)) {
    NSArray<NSString *> *dlPaths = NSSearchPathForDirectoriesInDomains(NSDownloadsDirectory, NSUserDomainMask, YES);
    if (dlPaths.firstObject) {
      downloadDir = dlPaths.firstObject;
    }
  }

  return @{
    @"documentDir": docDir,
    @"cacheDir": cacheDir,
    @"tempDir": tempDir,
    @"downloadDir": downloadDir,
  };
}

// ──────────────────────────────────────────────────────────────────────
#pragma mark - Handle Factories
// ──────────────────────────────────────────────────────────────────────

- (NSNumber *)openRead:(NSString *)path bufferSize:(double)bufferSize {
  NSInteger size = (NSInteger)bufferSize;
  if (size < 4096 || size > 67108864) {
    return @(-1);
  }

  NSError *error = nil;
  ReaderHandleIOS *reader = [[ReaderHandleIOS alloc] initWithPath:path
                                                       bufferSize:size
                                                            error:&error];
  if (!reader) {
    return @(-1);
  }

  NSInteger handleId = [[HandleRegistry shared] registerObject:reader];
  return @(handleId);
}

- (NSNumber *)openWrite:(NSString *)path append:(BOOL)append {
  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *parentDir = [path stringByDeletingLastPathComponent];
  if (![fm fileExistsAtPath:parentDir]) {
    [fm createDirectoryAtPath:parentDir withIntermediateDirectories:YES attributes:nil error:nil];
  }

  NSError *error = nil;
  WriterHandleIOS *writer = [[WriterHandleIOS alloc] initWithPath:path
                                                           append:append
                                                            error:&error];
  if (!writer) {
    return @(-1);
  }

  NSInteger handleId = [[HandleRegistry shared] registerObject:writer];
  return @(handleId);
}

- (NSNumber *)createDownload:(NSString *)url destPath:(NSString *)destPath headers:(NSDictionary *)headers {
  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *parentDir = [destPath stringByDeletingLastPathComponent];
  if (![fm fileExistsAtPath:parentDir]) {
    [fm createDirectoryAtPath:parentDir withIntermediateDirectories:YES attributes:nil error:nil];
  }

  NSMutableDictionary<NSString *, NSString *> *headerMap = [NSMutableDictionary new];
  [headers enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL *stop) {
    if ([key isKindOfClass:[NSString class]] && [value isKindOfClass:[NSString class]]) {
      headerMap[key] = value;
    }
  }];

  DownloaderHandleIOS *handle = [[DownloaderHandleIOS alloc] initWithURL:url
                                                                destPath:destPath
                                                                 headers:headerMap];
  NSInteger handleId = [[HandleRegistry shared] registerObject:handle];
  return @(handleId);
}

- (void)closeHandle:(double)handleId {
  [[HandleRegistry shared] removeObjectForId:(NSInteger)handleId];
}

// ──────────────────────────────────────────────────────────────────────
#pragma mark - FS Operations
// ──────────────────────────────────────────────────────────────────────

- (void)exists:(NSString *)path
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    BOOL exists = [[NSFileManager defaultManager] fileExistsAtPath:path];
    resolve(@(exists));
  });
}

- (void)stat:(NSString *)path
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    NSError *error = nil;
    NSDictionary *attrs = [fm attributesOfItemAtPath:path error:&error];
    if (!attrs) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] File does not exist: %@", path],
             error);
      return;
    }

    int64_t size = [attrs[NSFileSize] longLongValue];
    NSDate *modDate = attrs[NSFileModificationDate] ?: [NSDate date];
    NSString *fileType = attrs[NSFileType];

    NSString *type;
    if ([fileType isEqualToString:NSFileTypeDirectory]) {
      type = @"directory";
    } else if ([fileType isEqualToString:NSFileTypeRegular]) {
      type = @"file";
    } else {
      type = @"unknown";
    }

    NSString *name = [path lastPathComponent];
    resolve(@{
      @"path": path,
      @"name": name,
      @"size": @(size),
      @"type": type,
      @"lastModified": @(modDate.timeIntervalSince1970 * 1000),
    });
  });
}

- (void)unlink:(NSString *)path
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    NSError *error = nil;
    if (![fm removeItemAtPath:path error:&error]) {
      // Map "file not found" NSCocoa errors to the same ERR_FS format
      if (error.code == NSFileNoSuchFileError || error.code == NSFileReadNoSuchFileError) {
        reject(@"ERR_FS",
               [NSString stringWithFormat:@"[FILE_NOT_FOUND] File does not exist: %@", path],
               error);
      } else {
        reject(@"ERR_FS", error.localizedDescription, error);
      }
      return;
    }
    resolve(nil);
  });
}

- (void)mkdir:(NSString *)path
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    BOOL isDir = NO;
    if ([fm fileExistsAtPath:path isDirectory:&isDir]) {
      if (isDir) {
        resolve(nil);
        return;
      }
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[INVALID_ARGUMENT] Path exists and is not a directory: %@", path],
             nil);
      return;
    }

    NSError *error = nil;
    if (![fm createDirectoryAtPath:path withIntermediateDirectories:YES attributes:nil error:&error]) {
      reject(@"ERR_FS", error.localizedDescription, error);
      return;
    }
    resolve(nil);
  });
}

- (void)ls:(NSString *)path
   resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    BOOL isDir = NO;
    if (![fm fileExistsAtPath:path isDirectory:&isDir]) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] Directory does not exist: %@", path],
             nil);
      return;
    }
    if (!isDir) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[NOT_A_DIRECTORY] Path is not a directory: %@", path],
             nil);
      return;
    }

    NSError *error = nil;
    NSArray<NSString *> *contents = [fm contentsOfDirectoryAtPath:path error:&error];
    if (!contents) {
      reject(@"ERR_FS", error.localizedDescription, error);
      return;
    }

    NSMutableArray *results = [NSMutableArray new];
    for (NSString *item in contents) {
      NSString *fullPath = [path stringByAppendingPathComponent:item];
      NSDictionary *attrs = [fm attributesOfItemAtPath:fullPath error:nil];
      if (!attrs) continue;

      int64_t size = [attrs[NSFileSize] longLongValue];
      NSDate *modDate = attrs[NSFileModificationDate] ?: [NSDate date];
      NSString *fileType = attrs[NSFileType];

      NSString *type;
      if ([fileType isEqualToString:NSFileTypeDirectory]) {
        type = @"directory";
      } else if ([fileType isEqualToString:NSFileTypeRegular]) {
        type = @"file";
      } else {
        type = @"unknown";
      }

      [results addObject:@{
        @"path": fullPath,
        @"name": item,
        @"size": @(size),
        @"type": type,
        @"lastModified": @(modDate.timeIntervalSince1970 * 1000),
      }];
    }
    resolve(results);
  });
}

- (void)cp:(NSString *)srcPath
  destPath:(NSString *)destPath
   resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    if (![fm fileExistsAtPath:srcPath]) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] Source does not exist: %@", srcPath],
             nil);
      return;
    }

    NSString *parentDir = [destPath stringByDeletingLastPathComponent];
    if (![fm fileExistsAtPath:parentDir]) {
      [fm createDirectoryAtPath:parentDir withIntermediateDirectories:YES attributes:nil error:nil];
    }

    if ([fm fileExistsAtPath:destPath]) {
      [fm removeItemAtPath:destPath error:nil];
    }

    NSError *error = nil;
    if (![fm copyItemAtPath:srcPath toPath:destPath error:&error]) {
      reject(@"ERR_FS", error.localizedDescription, error);
      return;
    }
    resolve(nil);
  });
}

- (void)mv:(NSString *)srcPath
  destPath:(NSString *)destPath
   resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    if (![fm fileExistsAtPath:srcPath]) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] Source does not exist: %@", srcPath],
             nil);
      return;
    }

    NSString *parentDir = [destPath stringByDeletingLastPathComponent];
    if (![fm fileExistsAtPath:parentDir]) {
      [fm createDirectoryAtPath:parentDir withIntermediateDirectories:YES attributes:nil error:nil];
    }

    if ([fm fileExistsAtPath:destPath]) {
      [fm removeItemAtPath:destPath error:nil];
    }

    NSError *error = nil;
    if (![fm moveItemAtPath:srcPath toPath:destPath error:&error]) {
      reject(@"ERR_FS", error.localizedDescription, error);
      return;
    }
    resolve(nil);
  });
}

- (void)hashFile:(NSString *)path
       algorithm:(NSString *)algorithm
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    BOOL isDir = NO;
    if ([fm fileExistsAtPath:path isDirectory:&isDir] && isDir) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[INVALID_ARGUMENT] Cannot hash a directory: %@", path],
             nil);
      return;
    }

    NSInputStream *inputStream = [NSInputStream inputStreamWithFileAtPath:path];
    if (!inputStream) {
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] File does not exist: %@", path],
             nil);
      return;
    }
    [inputStream open];
    if (inputStream.streamStatus == NSStreamStatusError) {
      [inputStream close];
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[FILE_NOT_FOUND] File does not exist: %@", path],
             nil);
      return;
    }

    const NSUInteger kBufferSize = 8192;
    uint8_t *buffer = malloc(kBufferSize);
    if (!buffer) {
      [inputStream close];
      reject(@"ERR_FS", @"[READ_ERROR] Failed to allocate buffer", nil);
      return;
    }

    if ([algorithm isEqualToString:@"sha256"]) {
      CC_SHA256_CTX ctx;
      CC_SHA256_Init(&ctx);

      while ([inputStream hasBytesAvailable]) {
        NSInteger bytesRead = [inputStream read:buffer maxLength:kBufferSize];
        if (bytesRead < 0) {
          free(buffer);
          [inputStream close];
          reject(@"ERR_FS", @"[READ_ERROR] Error reading file", nil);
          return;
        }
        if (bytesRead == 0) break;
        CC_SHA256_Update(&ctx, buffer, (CC_LONG)bytesRead);
      }

      unsigned char digest[CC_SHA256_DIGEST_LENGTH];
      CC_SHA256_Final(digest, &ctx);

      free(buffer);
      [inputStream close];

      NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
      for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [hex appendFormat:@"%02x", digest[i]];
      }
      resolve(hex);

    } else if ([algorithm isEqualToString:@"md5"]) {
      CC_MD5_CTX ctx;
      CC_MD5_Init(&ctx);

      while ([inputStream hasBytesAvailable]) {
        NSInteger bytesRead = [inputStream read:buffer maxLength:kBufferSize];
        if (bytesRead < 0) {
          free(buffer);
          [inputStream close];
          reject(@"ERR_FS", @"[READ_ERROR] Error reading file", nil);
          return;
        }
        if (bytesRead == 0) break;
        CC_MD5_Update(&ctx, buffer, (CC_LONG)bytesRead);
      }

      unsigned char digest[CC_MD5_DIGEST_LENGTH];
      CC_MD5_Final(digest, &ctx);

      free(buffer);
      [inputStream close];

      NSMutableString *hex = [NSMutableString stringWithCapacity:CC_MD5_DIGEST_LENGTH * 2];
      for (int i = 0; i < CC_MD5_DIGEST_LENGTH; i++) {
        [hex appendFormat:@"%02x", digest[i]];
      }
      resolve(hex);

    } else {
      free(buffer);
      [inputStream close];
      reject(@"ERR_FS",
             [NSString stringWithFormat:@"[INVALID_ARGUMENT] Unknown algorithm: %@", algorithm],
             nil);
    }
  });
}

@end
