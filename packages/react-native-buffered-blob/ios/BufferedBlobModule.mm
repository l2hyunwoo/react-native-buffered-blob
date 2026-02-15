#import <React/RCTBridgeModule.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/CallInvoker.h>
#import <jsi/jsi.h>
#import "BufferedBlobStreamingBridge.h"
#import "BufferedBlobModule.h"
#import "HandleRegistry.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <BufferedBlobSpec/BufferedBlobSpec.h>
#endif

@interface BufferedBlobModuleBridge : NSObject <
#ifdef RCT_NEW_ARCH_ENABLED
  NativeBufferedBlobSpec
#else
  RCTBridgeModule
#endif
>
@property (nonatomic, strong) BufferedBlobModule *module;
- (void)setRuntimePointer:(facebook::jsi::Runtime *)runtime;
@end

#ifdef RCT_NEW_ARCH_ENABLED
namespace facebook::react {

/**
 * Subclass the codegen JSI wrapper to intercept install() and capture
 * the jsi::Runtime reference, which is only available inside JSI host functions.
 */
class BufferedBlobSpecJSI : public NativeBufferedBlobSpecJSI {
public:
  BufferedBlobSpecJSI(const ObjCTurboModule::InitParams &params)
    : NativeBufferedBlobSpecJSI(params) {
    // Override install to capture runtime before delegating to ObjC
    methodMap_["install"] = MethodMetadata {0,
      [](jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value *args, size_t count) -> jsi::Value {
        auto &self = static_cast<BufferedBlobSpecJSI &>(turboModule);
        auto *module = static_cast<BufferedBlobModuleBridge *>(self.instance_);
        [module setRuntimePointer:&rt];
        return static_cast<ObjCTurboModule &>(turboModule).invokeObjCMethod(
            rt, BooleanKind, "install", @selector(install), args, count);
      }
    };
  }
};

} // namespace facebook::react
#endif

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

- (void)setRuntimePointer:(facebook::jsi::Runtime *)runtime {
  _runtime = runtime;
}

- (NSDictionary *)constantsToExport {
  return [_module constantsToExport];
}

- (NSDictionary *)getConstants {
  return [self constantsToExport];
}

// --- install(): Wire JSI HostObject ---
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  @try {
    // New arch path: runtime and callInvoker are captured by
    // getTurboModule: (callInvoker) and the JSI install() override (runtime).
    if (_runtime && _callInvoker) {
      installBufferedBlobStreaming(*_runtime, _callInvoker);
      return @(YES);
    }

    // Old arch / bridge fallback
    RCTBridge *bridge = self.bridge;
    if (!bridge) {
      bridge = [RCTBridge currentBridge];
    }
    if (!bridge) {
      return @(NO);
    }

    RCTCxxBridge *target = (RCTCxxBridge *)(bridge.batchedBridge ?: bridge);

    void *runtimePtr = target.runtime;
    if (!runtimePtr) {
      return @(NO);
    }
    facebook::jsi::Runtime *runtime = (facebook::jsi::Runtime *)runtimePtr;

    auto callInvoker = [bridge jsCallInvoker];
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

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  _callInvoker = params.jsInvoker;
  return std::make_shared<facebook::react::BufferedBlobSpecJSI>(params);
}
#endif

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
