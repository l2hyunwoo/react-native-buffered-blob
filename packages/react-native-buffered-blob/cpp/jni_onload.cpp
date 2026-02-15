#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <ReactCommon/CallInvokerHolder.h>
#include "BufferedBlobStreamingHostObject.h"
#include "AndroidPlatformBridge.h"

using namespace facebook;

extern "C" JNIEXPORT void JNICALL
Java_com_bufferedblob_BufferedBlobModule_nativeInstall(
    JNIEnv* env,
    jobject thiz,
    jlong jsiPtr,
    jobject callInvokerHolder) {
  auto& runtime = *reinterpret_cast<jsi::Runtime*>(jsiPtr);

  auto callInvokerHolderRef =
      jni::make_local(reinterpret_cast<react::CallInvokerHolder::javaobject>(
          callInvokerHolder));
  auto callInvoker = callInvokerHolderRef->cthis()->getCallInvoker();

  auto bridge = std::make_shared<bufferedblob::AndroidPlatformBridge>(env);

  bufferedblob::BufferedBlobStreamingHostObject::install(
      runtime, callInvoker, bridge);
}

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void*) {
  return jni::initialize(vm, [] {
    // No native methods to register via fbjni - we use raw JNI above
  });
}
