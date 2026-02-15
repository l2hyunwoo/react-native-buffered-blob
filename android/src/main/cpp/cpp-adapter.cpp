#include <jni.h>
#include "nitroblobOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroblob::initialize(vm);
}
