#pragma once

#import <Foundation/Foundation.h>

@class HandleRegistry;

/**
 * Core BufferedBlob module implementation.
 * Provides handle factories for readers/writers/downloaders and
 * common filesystem operations (exists, stat, unlink, mkdir, ls, cp, mv, hash).
 *
 * All async FS operations are dispatched to global concurrent queues.
 * FileManager.default is documented as safe for concurrent use from multiple queues
 * for basic operations (exists, stat, unlink, mkdir, ls, cp, mv).
 */
@interface BufferedBlobModule : NSObject

+ (NSString *)moduleName;
+ (BOOL)requiresMainQueueSetup;

- (NSDictionary *)constantsToExport;

// Handle factories
- (NSNumber *)openRead:(NSString *)path bufferSize:(double)bufferSize;
- (NSNumber *)openWrite:(NSString *)path append:(BOOL)append;
- (NSNumber *)createDownload:(NSString *)url destPath:(NSString *)destPath headers:(NSDictionary *)headers;
- (void)closeHandle:(double)handleId;

// FS operations (async with promise callbacks)
typedef void (^RCTPromiseResolveBlock)(id _Nullable result);
typedef void (^RCTPromiseRejectBlock)(NSString * _Nullable code,
                                      NSString * _Nullable message,
                                      NSError * _Nullable error);

- (void)exists:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)stat:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)unlink:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)mkdir:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)ls:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)cp:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)mv:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)hashFile:(NSString *)path algorithm:(NSString *)algorithm resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;

@end
