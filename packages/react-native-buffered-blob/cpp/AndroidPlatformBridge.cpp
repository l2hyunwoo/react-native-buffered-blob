#include "AndroidPlatformBridge.h"
#include <fbjni/fbjni.h>
#include <thread>

namespace bufferedblob {

using namespace facebook;

AndroidPlatformBridge::AndroidPlatformBridge(JNIEnv* env) {
  auto clazz = env->FindClass("com/bufferedblob/StreamingBridge");
  bridgeClass_ = jni::make_global(jni::adopt_local_ref(clazz));
}

void AndroidPlatformBridge::readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;
  std::thread([bridgeClass, handleId, onSuccess = std::move(onSuccess),
               onEOF = std::move(onEOF), onError = std::move(onError)]() {
    try {
      jni::ThreadScope ts;
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(
          bridgeClass.get(), "readNextChunk", "(I)[B");
      if (!method) {
        onError("readNextChunk method not found");
        return;
      }

      auto result = (jbyteArray)env->CallStaticObjectMethod(
          bridgeClass.get(), method, handleId);

      if (env->ExceptionCheck()) {
        jthrowable ex = env->ExceptionOccurred();
        env->ExceptionClear();
        jclass throwableClass = env->FindClass("java/lang/Throwable");
        jmethodID getMessage = env->GetMethodID(
            throwableClass, "getMessage", "()Ljava/lang/String;");
        auto msg = (jstring)env->CallObjectMethod(ex, getMessage);
        const char* msgChars = env->GetStringUTFChars(msg, nullptr);
        std::string errorMsg(msgChars);
        env->ReleaseStringUTFChars(msg, msgChars);
        env->DeleteLocalRef(ex);
        env->DeleteLocalRef(msg);
        onError(errorMsg);
        return;
      }

      if (result == nullptr) {
        onEOF();
        return;
      }

      jsize len = env->GetArrayLength(result);
      std::vector<uint8_t> data(len);
      env->GetByteArrayRegion(
          result, 0, len, reinterpret_cast<jbyte*>(data.data()));
      env->DeleteLocalRef(result);
      onSuccess(std::move(data));
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  }).detach();
}

void AndroidPlatformBridge::write(
    int handleId,
    const uint8_t* data,
    size_t size,
    std::function<void(int)> onSuccess,
    std::function<void(std::string)> onError) {
  // Copy data for the thread
  std::vector<uint8_t> dataCopy(data, data + size);
  auto bridgeClass = bridgeClass_;

  std::thread([bridgeClass, handleId, dataCopy = std::move(dataCopy),
               onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      jni::ThreadScope ts;
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(
          bridgeClass.get(), "write", "(I[B)I");
      if (!method) {
        onError("write method not found");
        return;
      }

      jbyteArray arr = env->NewByteArray(static_cast<jsize>(dataCopy.size()));
      env->SetByteArrayRegion(
          arr, 0, static_cast<jsize>(dataCopy.size()),
          reinterpret_cast<const jbyte*>(dataCopy.data()));

      jint result = env->CallStaticIntMethod(
          bridgeClass.get(), method, handleId, arr);
      env->DeleteLocalRef(arr);

      if (env->ExceptionCheck()) {
        jthrowable ex = env->ExceptionOccurred();
        env->ExceptionClear();
        jclass throwableClass = env->FindClass("java/lang/Throwable");
        jmethodID getMessage = env->GetMethodID(
            throwableClass, "getMessage", "()Ljava/lang/String;");
        auto msg = (jstring)env->CallObjectMethod(ex, getMessage);
        const char* msgChars = env->GetStringUTFChars(msg, nullptr);
        std::string errorMsg(msgChars);
        env->ReleaseStringUTFChars(msg, msgChars);
        env->DeleteLocalRef(ex);
        env->DeleteLocalRef(msg);
        onError(errorMsg);
        return;
      }

      onSuccess(static_cast<int>(result));
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  }).detach();
}

void AndroidPlatformBridge::flush(
    int handleId,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;

  std::thread([bridgeClass, handleId, onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      jni::ThreadScope ts;
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(
          bridgeClass.get(), "flush", "(I)V");
      if (!method) {
        onError("flush method not found");
        return;
      }

      env->CallStaticVoidMethod(bridgeClass.get(), method, handleId);

      if (env->ExceptionCheck()) {
        jthrowable ex = env->ExceptionOccurred();
        env->ExceptionClear();
        jclass throwableClass = env->FindClass("java/lang/Throwable");
        jmethodID getMessage = env->GetMethodID(
            throwableClass, "getMessage", "()Ljava/lang/String;");
        auto msg = (jstring)env->CallObjectMethod(ex, getMessage);
        const char* msgChars = env->GetStringUTFChars(msg, nullptr);
        std::string errorMsg(msgChars);
        env->ReleaseStringUTFChars(msg, msgChars);
        env->DeleteLocalRef(ex);
        env->DeleteLocalRef(msg);
        onError(errorMsg);
        return;
      }

      onSuccess();
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  }).detach();
}

void AndroidPlatformBridge::close(int handleId) {
  try {
    jni::ThreadScope ts;
    JNIEnv* env = jni::Environment::current();

    jmethodID method = env->GetStaticMethodID(
        bridgeClass_.get(), "close", "(I)V");
    if (method) {
      env->CallStaticVoidMethod(bridgeClass_.get(), method, handleId);
      if (env->ExceptionCheck()) {
        env->ExceptionClear();
      }
    }
  } catch (...) {
    // Swallow close errors
  }
}

void AndroidPlatformBridge::startDownload(
    int handleId,
    std::function<void(double, double, double)> onProgress,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;

  std::thread([bridgeClass, handleId, onProgress = std::move(onProgress),
               onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      jni::ThreadScope ts;
      JNIEnv* env = jni::Environment::current();

      // Create a DownloadCallback instance that wraps our C++ callbacks
      jclass callbackClass = env->FindClass(
          "com/bufferedblob/StreamingBridge$DownloadCallback");
      if (!callbackClass) {
        onError("DownloadCallback class not found");
        return;
      }

      // Use startDownload static method which handles the download
      // and calls progress/completion synchronously on the calling thread
      jmethodID method = env->GetStaticMethodID(
          bridgeClass.get(), "startDownloadSync",
          "(ILcom/bufferedblob/StreamingBridge$DownloadCallback;)V");

      if (!method) {
        // Fallback: try simpler download without progress
        jmethodID simpleMethod = env->GetStaticMethodID(
            bridgeClass.get(), "startDownloadSimple", "(I)V");
        if (!simpleMethod) {
          onError("startDownload method not found");
          return;
        }
        env->CallStaticVoidMethod(bridgeClass.get(), simpleMethod, handleId);
        if (env->ExceptionCheck()) {
          jthrowable ex = env->ExceptionOccurred();
          env->ExceptionClear();
          jclass throwableClass = env->FindClass("java/lang/Throwable");
          jmethodID getMessage = env->GetMethodID(
              throwableClass, "getMessage", "()Ljava/lang/String;");
          auto msg = (jstring)env->CallObjectMethod(ex, getMessage);
          const char* msgChars = env->GetStringUTFChars(msg, nullptr);
          std::string errorMsg(msgChars);
          env->ReleaseStringUTFChars(msg, msgChars);
          env->DeleteLocalRef(ex);
          env->DeleteLocalRef(msg);
          onError(errorMsg);
          return;
        }
        onSuccess();
        return;
      }

      // Create native callback via JNI
      // For simplicity, we use a blocking approach: the download runs
      // on the current thread and we poll for progress
      // This is acceptable since we're already on a detached thread
      jmethodID startMethod = env->GetStaticMethodID(
          bridgeClass.get(), "startDownload", "(I)V");
      if (startMethod) {
        env->CallStaticVoidMethod(bridgeClass.get(), startMethod, handleId);
        if (env->ExceptionCheck()) {
          jthrowable ex = env->ExceptionOccurred();
          env->ExceptionClear();
          jclass throwableClass = env->FindClass("java/lang/Throwable");
          jmethodID getMessage = env->GetMethodID(
              throwableClass, "getMessage", "()Ljava/lang/String;");
          auto msg = (jstring)env->CallObjectMethod(ex, getMessage);
          const char* msgChars = env->GetStringUTFChars(msg, nullptr);
          std::string errorMsg(msgChars);
          env->ReleaseStringUTFChars(msg, msgChars);
          env->DeleteLocalRef(ex);
          env->DeleteLocalRef(msg);
          onError(errorMsg);
          return;
        }
        onSuccess();
      } else {
        onError("No download method available");
      }
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  }).detach();
}

void AndroidPlatformBridge::cancelDownload(int handleId) {
  try {
    jni::ThreadScope ts;
    JNIEnv* env = jni::Environment::current();

    jmethodID method = env->GetStaticMethodID(
        bridgeClass_.get(), "cancelDownload", "(I)V");
    if (method) {
      env->CallStaticVoidMethod(bridgeClass_.get(), method, handleId);
      if (env->ExceptionCheck()) {
        env->ExceptionClear();
      }
    }
  } catch (...) {
    // Swallow cancel errors
  }
}

PlatformBridge::ReaderInfo AndroidPlatformBridge::getReaderInfo(int handleId) {
  ReaderInfo info{0, 0, false};
  try {
    jni::ThreadScope ts;
    JNIEnv* env = jni::Environment::current();

    jmethodID method = env->GetStaticMethodID(
        bridgeClass_.get(), "getReaderFileSize", "(I)J");
    if (method) {
      info.fileSize = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_.get(), method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }

    method = env->GetStaticMethodID(
        bridgeClass_.get(), "getReaderBytesRead", "(I)J");
    if (method) {
      info.bytesRead = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_.get(), method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }

    method = env->GetStaticMethodID(
        bridgeClass_.get(), "getReaderIsEOF", "(I)Z");
    if (method) {
      info.isEOF = env->CallStaticBooleanMethod(
          bridgeClass_.get(), method, handleId);
      if (env->ExceptionCheck()) env->ExceptionClear();
    }
  } catch (...) {
    // Return default info
  }
  return info;
}

PlatformBridge::WriterInfo AndroidPlatformBridge::getWriterInfo(int handleId) {
  WriterInfo info{0};
  try {
    jni::ThreadScope ts;
    JNIEnv* env = jni::Environment::current();

    jmethodID method = env->GetStaticMethodID(
        bridgeClass_.get(), "getWriterBytesWritten", "(I)J");
    if (method) {
      info.bytesWritten = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_.get(), method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }
  } catch (...) {
    // Return default info
  }
  return info;
}

} // namespace bufferedblob
