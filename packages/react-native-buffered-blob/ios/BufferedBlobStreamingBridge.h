#pragma once

#import <React/RCTBridgeModule.h>
#import <ReactCommon/CallInvoker.h>
#import <jsi/jsi.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Install the BufferedBlobStreaming JSI HostObject on the given runtime.
 * Called from BufferedBlobModule.mm during install().
 */
void installBufferedBlobStreaming(
    facebook::jsi::Runtime& runtime,
    std::shared_ptr<facebook::react::CallInvoker> callInvoker);

#ifdef __cplusplus
}
#endif
