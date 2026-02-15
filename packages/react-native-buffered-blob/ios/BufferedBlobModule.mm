#import <React/RCTBridgeModule.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/CallInvoker.h>
#import <jsi/jsi.h>
#import "BufferedBlobStreamingBridge.h"
#import "BufferedBlobModule.h"
#import "HandleRegistry.h"

@interface BufferedBlobModuleBridge : NSObject <RCTBridgeModule>
@property (nonatomic, strong) BufferedBlobModule *module;
@end

@implementation BufferedBlobModuleBridge {
  facebook::jsi::Runtime *_runtime;
  std::shared_ptr<facebook::react::CallInvoker> _callInvoker;
}

RCT_EXPORT_MODULE(BufferedBlob)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _module = [[BufferedBlobModule alloc] init];
    _runtime = nullptr;
  }
  return self;
}

- (NSDictionary *)constantsToExport {
  return [_module constantsToExport];
}

// --- install(): Wire JSI HostObject ---
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  @try {
    RCTBridge *bridge = self.bridge;
    if (!bridge) {
      bridge = [RCTBridge currentBridge];
    }
    if (!bridge) {
      return @(NO);
    }

    // runtime lives on RCTCxxBridge (the batchedBridge)
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)(bridge.batchedBridge ?: bridge);
    if (![cxxBridge isKindOfClass:[RCTCxxBridge class]]) {
      return @(NO);
    }

    // Access runtime via RCTCxxBridge
    void *runtimePtr = cxxBridge.runtime;
    if (!runtimePtr) {
      return @(NO);
    }
    facebook::jsi::Runtime *runtime = (facebook::jsi::Runtime *)runtimePtr;

    // jsCallInvoker is a category method on RCTBridge from RCTTurboModule.h
    auto callInvoker = [cxxBridge jsCallInvoker];
    if (!callInvoker) {
      return @(NO);
    }

    _runtime = runtime;
    _callInvoker = callInvoker;

    installBufferedBlobStreaming(*_runtime, _callInvoker);
    return @(YES);
  } @catch (NSException *exception) {
    NSLog(@"[BufferedBlob] install() failed: %@", exception.reason);
    return @(NO);
  }
}

// --- Handle Factories ---
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(openRead:(NSString *)path bufferSize:(double)bufferSize) {
  return [_module openRead:path bufferSize:bufferSize];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(openWrite:(NSString *)path append:(BOOL)append) {
  return [_module openWrite:path append:append];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createDownload:(NSString *)url destPath:(NSString *)destPath headers:(NSDictionary *)headers) {
  return [_module createDownload:url destPath:destPath headers:headers];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(closeHandle:(double)handleId) {
  [_module closeHandle:handleId];
  return nil;
}

// --- FS Operations ---
RCT_EXPORT_METHOD(exists:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module exists:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(stat:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module stat:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(unlink:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module unlink:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(mkdir:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module mkdir:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(ls:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module ls:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(cp:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module cp:srcPath destPath:destPath resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(mv:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module mv:srcPath destPath:destPath resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(hashFile:(NSString *)path algorithm:(NSString *)algorithm resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_module hashFile:path algorithm:algorithm resolve:resolve reject:reject];
}

- (void)invalidate {
  [[HandleRegistry shared] clear];
  _runtime = nullptr;
  _callInvoker = nullptr;
}

@end
