#include <jni.h>
#include "bufferedblobOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::bufferedblob::initialize(vm);
}
