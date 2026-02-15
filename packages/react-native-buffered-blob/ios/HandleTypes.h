#pragma once

#import <Foundation/Foundation.h>
#import "HandleRegistry.h"

/**
 * Reader handle: wraps an NSInputStream for buffered file reading.
 * All I/O is dispatched to a dedicated serial queue for thread safety.
 */
@interface ReaderHandleIOS : NSObject <HandleCloseable>

@property (nonatomic, strong, readonly) NSInputStream *inputStream;
@property (nonatomic, assign, readonly) NSInteger bufferSize;
@property (nonatomic, assign, readonly) int64_t fileSize;

/** Serial queue for dispatching I/O operations from the C++ bridge. */
@property (nonatomic, strong, readonly) dispatch_queue_t queue;

/** Bytes read so far. Thread-safe via internal lock. */
@property (atomic, assign) int64_t bytesRead;
/** Whether the stream has reached end-of-file. Thread-safe via internal lock. */
@property (atomic, assign) BOOL isEOF;
/** Whether the handle has been closed. Thread-safe via internal lock. */
@property (atomic, assign) BOOL isClosed;

- (nullable instancetype)initWithPath:(NSString *)path
                           bufferSize:(NSInteger)bufferSize
                                error:(NSError **)error;
- (instancetype)init NS_UNAVAILABLE;

@end

/**
 * Writer handle: wraps an NSOutputStream for buffered file writing.
 * All I/O is dispatched to a dedicated serial queue for thread safety.
 */
@interface WriterHandleIOS : NSObject <HandleCloseable>

@property (nonatomic, strong, readonly) NSOutputStream *outputStream;

/** Serial queue for dispatching I/O operations from the C++ bridge. */
@property (nonatomic, strong, readonly) dispatch_queue_t queue;

/** Bytes written so far. Thread-safe via atomic. */
@property (atomic, assign) int64_t bytesWritten;
/** Whether the handle has been closed. Thread-safe via atomic. */
@property (atomic, assign) BOOL isClosed;

- (nullable instancetype)initWithPath:(NSString *)path
                               append:(BOOL)append
                                error:(NSError **)error;
- (instancetype)init NS_UNAVAILABLE;

@end

/**
 * Downloader handle: manages a URLSession download to a file.
 * Supports cancellation via the cancel method.
 */
@interface DownloaderHandleIOS : NSObject <HandleCloseable>

@property (nonatomic, copy, readonly) NSString *url;
@property (nonatomic, copy, readonly) NSString *destPath;
@property (nonatomic, copy, readonly) NSDictionary<NSString *, NSString *> *headers;

/** Serial queue exposed for future use if needed. */
@property (nonatomic, strong, readonly) dispatch_queue_t queue;

/** Whether the download has been cancelled. Thread-safe via atomic. */
@property (atomic, assign) BOOL isCancelled;

- (instancetype)initWithURL:(NSString *)url
                   destPath:(NSString *)destPath
                    headers:(NSDictionary<NSString *, NSString *> *)headers;
- (instancetype)init NS_UNAVAILABLE;

/** Store the session and task so cancel can properly invalidate them. */
- (void)storeSession:(NSURLSession *)session task:(NSURLSessionTask *)task;

/** Cancel the download, invalidating the session. */
- (void)cancel;

@end
