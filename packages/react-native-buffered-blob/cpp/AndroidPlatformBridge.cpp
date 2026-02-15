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
  auto clazz = env->FindClass("com/bufferedblob/StreamingBridge");
  bridgeClass_ = jni::make_global(jni::adopt_local_ref(clazz));
  initThreadPool();
}

AndroidPlatformBridge::~AndroidPlatformBridge() {
  shutdown_.store(true);
  queueCV_.notify_all();
  for (auto& worker : poolWorkers_) {
    if (worker.joinable()) worker.join();
  }
}

// --- Read (uses thread pool) ---

void AndroidPlatformBridge::readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;
  submitTask([bridgeClass, handleId, onSuccess = std::move(onSuccess),
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
      // Use GetPrimitiveArrayCritical for zero-copy access when possible
      jbyte* rawBytes = static_cast<jbyte*>(
          env->GetPrimitiveArrayCritical(result, nullptr));
      if (rawBytes) {
        std::memcpy(data.data(), rawBytes, len);
        env->ReleasePrimitiveArrayCritical(result, rawBytes, JNI_ABORT);
      } else {
        // Fallback if VM cannot pin the array
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
  auto bridgeClass = bridgeClass_;

  submitTask([bridgeClass, handleId, dataCopy = std::move(data),
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
  });
}

// --- Flush (uses thread pool) ---

void AndroidPlatformBridge::flush(
    int handleId,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;

  submitTask([bridgeClass, handleId, onSuccess = std::move(onSuccess),
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
  });
}

// --- Close (synchronous) ---

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

// --- Download (dedicated managed threads, NOT in pool) ---

void AndroidPlatformBridge::startDownload(
    int handleId,
    std::function<void(double, double, double)> onProgress,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError) {
  auto bridgeClass = bridgeClass_;

  // Downloads use a dedicated joinable thread (not the pool) to avoid
  // starvation -- downloads can block for minutes.
  auto downloadThread = std::thread([bridgeClass, handleId,
               onProgress = std::move(onProgress),
               onSuccess = std::move(onSuccess),
               onError = std::move(onError)]() {
    try {
      jni::ThreadScope ts;
      JNIEnv* env = jni::Environment::current();

      // Start progress polling in a lightweight timer thread
      auto done = std::make_shared<std::atomic<bool>>(false);

      std::thread pollThread([bridgeClass, handleId, onProgress, done]() {
        try {
          jni::ThreadScope pts;
          JNIEnv* pEnv = jni::Environment::current();

          jmethodID getBytesMethod = pEnv->GetStaticMethodID(
              bridgeClass.get(), "getDownloadBytesDownloaded", "(I)J");
          jmethodID getTotalMethod = pEnv->GetStaticMethodID(
              bridgeClass.get(), "getDownloadTotalBytes", "(I)J");

          if (!getBytesMethod || !getTotalMethod) return;

          while (!done->load()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
            if (done->load()) break;

            jlong downloaded = pEnv->CallStaticLongMethod(
                bridgeClass.get(), getBytesMethod, handleId);
            jlong total = pEnv->CallStaticLongMethod(
                bridgeClass.get(), getTotalMethod, handleId);
            if (pEnv->ExceptionCheck()) { pEnv->ExceptionClear(); break; }

            if (total > 0) {
              double progress = static_cast<double>(downloaded) / static_cast<double>(total);
              onProgress(static_cast<double>(downloaded),
                         static_cast<double>(total), progress);
            } else if (downloaded > 0) {
              onProgress(static_cast<double>(downloaded), -1.0, -1.0);
            }
          }
        } catch (...) {
          // Polling failure is non-fatal
        }
      });

      // Call startDownload synchronously (blocks until download completes)
      jmethodID method = env->GetStaticMethodID(
          bridgeClass.get(), "startDownload", "(I)V");
      if (!method) {
        done->store(true);
        if (pollThread.joinable()) pollThread.join();
        onError("startDownload method not found");
        return;
      }

      env->CallStaticVoidMethod(bridgeClass.get(), method, handleId);

      // Signal polling thread to stop and wait for it
      done->store(true);
      if (pollThread.joinable()) pollThread.join();

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
          bridgeClass.get(), "getDownloadBytesDownloaded", "(I)J");
      jmethodID getTotalMethod = env->GetStaticMethodID(
          bridgeClass.get(), "getDownloadTotalBytes", "(I)J");
      if (getBytesMethod && getTotalMethod) {
        jlong finalDownloaded = env->CallStaticLongMethod(
            bridgeClass.get(), getBytesMethod, handleId);
        jlong finalTotal = env->CallStaticLongMethod(
            bridgeClass.get(), getTotalMethod, handleId);
        if (!env->ExceptionCheck() && finalTotal > 0) {
          onProgress(static_cast<double>(finalDownloaded),
                     static_cast<double>(finalTotal), 1.0);
        }
        if (env->ExceptionCheck()) env->ExceptionClear();
      }

      onSuccess();
    } catch (const std::exception& e) {
      onError(std::string("JNI error: ") + e.what());
    }
  });
  // Detach download thread -- it manages its own polling thread lifecycle
  // and will complete when the download finishes
  downloadThread.detach();
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
