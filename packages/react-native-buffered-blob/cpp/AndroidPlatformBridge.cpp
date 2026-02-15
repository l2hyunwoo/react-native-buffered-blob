#include "AndroidPlatformBridge.h"
#include <fbjni/fbjni.h>
#include <cstring>
#include <thread>
#include <chrono>

namespace bufferedblob {

using namespace facebook;

// --- Thread Pool ---

void AndroidPlatformBridge::initThreadPool() {
  for (size_t i = 0; i < kPoolThreads; ++i) {
    poolWorkers_.emplace_back([this]() {
      // Use fbjni::ThreadScope to attach this worker thread to the JVM.
      // This registers the thread with fbjni's thread-local tracking so
      // that Environment::current() works -- which is required by
      // CallInvoker::invokeAsync() internally.
      jni::ThreadScope threadScope;
      while (true) {
        std::function<void()> task;
        {
          std::unique_lock<std::mutex> lock(queueMutex_);
          queueCV_.wait(lock, [this]() {
            return shutdown_.load() || !taskQueue_.empty();
          });
          if (shutdown_.load() && taskQueue_.empty()) return;
          task = std::move(taskQueue_.front());
          taskQueue_.pop();
        }
        task();
      }
    });
  }
}

void AndroidPlatformBridge::submitTask(std::function<void()> task) {
  {
    std::lock_guard<std::mutex> lock(queueMutex_);
    taskQueue_.push(std::move(task));
  }
  queueCV_.notify_one();
}

AndroidPlatformBridge::AndroidPlatformBridge(JNIEnv* env) {
  env->GetJavaVM(&vm_);
  auto clazz = env->FindClass("com/bufferedblob/StreamingBridge");
  bridgeClass_ = (jclass)env->NewGlobalRef(clazz);
  env->DeleteLocalRef(clazz);
  initThreadPool();
}

AndroidPlatformBridge::~AndroidPlatformBridge() {
  shutdown_.store(true);
  queueCV_.notify_all();
  for (auto& worker : poolWorkers_) {
    if (worker.joinable()) worker.join();
  }
  // Clean up global ref
  if (bridgeClass_) {
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK && env) {
      env->DeleteGlobalRef(bridgeClass_);
    }
  }
}

// --- Read (uses thread pool) ---

void AndroidPlatformBridge::readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError) {
  // Capture raw jclass (global ref) -- no fbjni copy, safe from any thread.
  jclass cls = bridgeClass_;
  submitTask([cls, handleId, onSuccess = std::move(onSuccess),
               onEOF = std::move(onEOF), onError = std::move(onError)]() {
    try {
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(cls, "readNextChunk", "(I)[B");
      if (!method) {
        onError("readNextChunk method not found");
        return;
      }

      auto result = (jbyteArray)env->CallStaticObjectMethod(cls, method, handleId);

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
      jbyte* rawBytes = static_cast<jbyte*>(
          env->GetPrimitiveArrayCritical(result, nullptr));
      if (rawBytes) {
        std::memcpy(data.data(), rawBytes, len);
        env->ReleasePrimitiveArrayCritical(result, rawBytes, JNI_ABORT);
      } else {
        env->GetByteArrayRegion(
            result, 0, len, reinterpret_cast<jbyte*>(data.data()));
      }
      env->DeleteLocalRef(result);
      onSuccess(std::move(data));
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  });
}

// --- Write (uses thread pool) ---

void AndroidPlatformBridge::write(
    int handleId,
    std::vector<uint8_t> data,
    std::function<void(int)> onSuccess,
    std::function<void(std::string)> onError) {
  jclass cls = bridgeClass_;

  submitTask([cls, handleId, dataCopy = std::move(data),
               onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(cls, "write", "(I[B)I");
      if (!method) {
        onError("write method not found");
        return;
      }

      jbyteArray arr = env->NewByteArray(static_cast<jsize>(dataCopy.size()));
      env->SetByteArrayRegion(
          arr, 0, static_cast<jsize>(dataCopy.size()),
          reinterpret_cast<const jbyte*>(dataCopy.data()));

      jint result = env->CallStaticIntMethod(cls, method, handleId, arr);
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
  });
}

// --- Flush (uses thread pool) ---

void AndroidPlatformBridge::flush(
    int handleId,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  jclass cls = bridgeClass_;

  submitTask([cls, handleId, onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(cls, "flush", "(I)V");
      if (!method) {
        onError("flush method not found");
        return;
      }

      env->CallStaticVoidMethod(cls, method, handleId);

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
  });
}

// --- Close (synchronous, called from JS thread) ---

void AndroidPlatformBridge::close(int handleId) {
  try {
    // Use raw JNI GetEnv -- this may be called from the JS thread which
    // is not registered with fbjni's thread-local tracking.
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK || !env) {
      return;
    }

    jmethodID method = env->GetStaticMethodID(bridgeClass_, "close", "(I)V");
    if (method) {
      env->CallStaticVoidMethod(bridgeClass_, method, handleId);
      if (env->ExceptionCheck()) {
        env->ExceptionClear();
      }
    }
  } catch (...) {
    // Swallow close errors
  }
}

// --- Download (dedicated managed threads, NOT in pool) ---

void AndroidPlatformBridge::startDownload(
    int handleId,
    std::function<void(double, double, double)> onProgress,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  // Capture raw jclass pointer -- avoids fbjni global_ref copy which calls
  // Environment::current() and crashes on threads without fbjni TLData.
  jclass cls = bridgeClass_;

  auto done = std::make_shared<std::atomic<bool>>(false);

  // Progress polling: timer thread sleeps, then submits JNI work to pool.
  auto self = this;
  std::thread([self, cls, handleId, onProgress, done]() {
    while (!done->load()) {
      std::this_thread::sleep_for(std::chrono::milliseconds(200));
      if (done->load()) break;

      self->submitTask([cls, handleId, onProgress, done]() {
        if (done->load()) return;
        try {
          JNIEnv* pEnv = jni::Environment::current();

          jmethodID getBytesMethod = pEnv->GetStaticMethodID(
              cls, "getDownloadBytesDownloaded", "(I)J");
          jmethodID getTotalMethod = pEnv->GetStaticMethodID(
              cls, "getDownloadTotalBytes", "(I)J");
          if (!getBytesMethod || !getTotalMethod) return;

          jlong downloaded = pEnv->CallStaticLongMethod(
              cls, getBytesMethod, handleId);
          jlong total = pEnv->CallStaticLongMethod(
              cls, getTotalMethod, handleId);
          if (pEnv->ExceptionCheck()) { pEnv->ExceptionClear(); return; }

          if (total > 0) {
            double progress = static_cast<double>(downloaded) / static_cast<double>(total);
            onProgress(static_cast<double>(downloaded),
                       static_cast<double>(total), progress);
          } else if (downloaded > 0) {
            onProgress(static_cast<double>(downloaded), -1.0, -1.0);
          }
        } catch (...) {
          // Polling failure is non-fatal
        }
      });
    }
  }).detach();

  // Download thread: uses ThreadScope for fbjni-compatible attachment.
  auto downloadThread = std::thread([cls, handleId, done,
               onProgress = std::move(onProgress),
               onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      jni::ThreadScope threadScope;
      JNIEnv* env = jni::Environment::current();

      jmethodID method = env->GetStaticMethodID(cls, "startDownload", "(I)V");
      if (!method) {
        done->store(true);
        onError("startDownload method not found");
        return;
      }

      env->CallStaticVoidMethod(cls, method, handleId);

      // Signal polling to stop
      done->store(true);

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

      // Read final progress values for a 100% callback
      jmethodID getBytesMethod = env->GetStaticMethodID(
          cls, "getDownloadBytesDownloaded", "(I)J");
      jmethodID getTotalMethod = env->GetStaticMethodID(
          cls, "getDownloadTotalBytes", "(I)J");
      if (getBytesMethod && getTotalMethod) {
        jlong finalDownloaded = env->CallStaticLongMethod(
            cls, getBytesMethod, handleId);
        jlong finalTotal = env->CallStaticLongMethod(
            cls, getTotalMethod, handleId);
        if (!env->ExceptionCheck() && finalTotal > 0) {
          onProgress(static_cast<double>(finalDownloaded),
                     static_cast<double>(finalTotal), 1.0);
        }
        if (env->ExceptionCheck()) env->ExceptionClear();
      }

      onSuccess();
    } catch (const std::exception& e) {
      done->store(true);
      onError(std::string("JNI error: ") + e.what());
    }
  });
  downloadThread.detach();
}

void AndroidPlatformBridge::cancelDownload(int handleId) {
  try {
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK || !env) {
      return;
    }

    jmethodID method = env->GetStaticMethodID(bridgeClass_, "cancelDownload", "(I)V");
    if (method) {
      env->CallStaticVoidMethod(bridgeClass_, method, handleId);
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
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK || !env) {
      return info;
    }

    jmethodID method = env->GetStaticMethodID(bridgeClass_, "getReaderFileSize", "(I)J");
    if (method) {
      info.fileSize = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_, method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }

    method = env->GetStaticMethodID(bridgeClass_, "getReaderBytesRead", "(I)J");
    if (method) {
      info.bytesRead = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_, method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }

    method = env->GetStaticMethodID(bridgeClass_, "getReaderIsEOF", "(I)Z");
    if (method) {
      info.isEOF = env->CallStaticBooleanMethod(bridgeClass_, method, handleId);
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
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK || !env) {
      return info;
    }

    jmethodID method = env->GetStaticMethodID(
        bridgeClass_, "getWriterBytesWritten", "(I)J");
    if (method) {
      info.bytesWritten = static_cast<double>(
          env->CallStaticLongMethod(bridgeClass_, method, handleId));
      if (env->ExceptionCheck()) env->ExceptionClear();
    }
  } catch (...) {
    // Return default info
  }
  return info;
}

} // namespace bufferedblob
