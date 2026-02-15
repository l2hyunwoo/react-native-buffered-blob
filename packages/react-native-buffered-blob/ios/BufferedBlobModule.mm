#import <React/RCTBridgeModule.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/CallInvoker.h>
#import <jsi/jsi.h>
#import "BufferedBlobStreamingBridge.h"

// Forward declaration - Swift class
@class BufferedBlobModule;

@interface BufferedBlobModuleBridge : NSObject <RCTBridgeModule, RCTTurboModule>
@property (nonatomic, strong) BufferedBlobModule *swiftModule;
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
    _swiftModule = [[BufferedBlobModule alloc] init];
    _runtime = nullptr;
  }
  return self;
}

- (NSDictionary *)constantsToExport {
  return [_swiftModule constantsToExport];
}

// --- install(): Wire JSI HostObject ---
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  @try {
    // Try bridgeless first (RN 0.74+)
    RCTBridge *bridge = [RCTBridge currentBridge];
    if (!bridge) {
      // Fallback: try to get bridge from module registry
      bridge = self.bridge;
    }

    if (bridge) {
      // Bridged mode: get runtime from bridge
      facebook::jsi::Runtime *runtime = (facebook::jsi::Runtime *)bridge.runtime;
      if (!runtime) {
        return @(NO);
      }

      auto callInvoker = bridge.jsCallInvoker;
      if (!callInvoker) {
        return @(NO);
      }

      _runtime = runtime;
      _callInvoker = callInvoker;

      installBufferedBlobStreaming(*_runtime, _callInvoker);
      return @(YES);
    }

    return @(NO);
  } @catch (NSException *exception) {
    NSLog(@"[BufferedBlob] install() failed: %@", exception.reason);
    return @(NO);
  }
}

// --- Handle Factories ---
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(openRead:(NSString *)path bufferSize:(double)bufferSize) {
  return [_swiftModule openRead:path bufferSize:bufferSize];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(openWrite:(NSString *)path append:(BOOL)append) {
  return [_swiftModule openWrite:path append:append];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(createDownload:(NSString *)url destPath:(NSString *)destPath headers:(NSDictionary *)headers) {
  return [_swiftModule createDownload:url destPath:destPath headers:headers];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(closeHandle:(double)handleId) {
  [_swiftModule closeHandle:handleId];
  return nil;
}

// --- FS Operations ---
RCT_EXPORT_METHOD(exists:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule exists:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(stat:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule stat:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(unlink:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule unlink:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(mkdir:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule mkdir:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(ls:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule ls:path resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(cp:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule cp:srcPath destPath:destPath resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(mv:(NSString *)srcPath destPath:(NSString *)destPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule mv:srcPath destPath:destPath resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(hashFile:(NSString *)path algorithm:(NSString *)algorithm resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [_swiftModule hashFile:path algorithm:algorithm resolve:resolve reject:reject];
}

@end
