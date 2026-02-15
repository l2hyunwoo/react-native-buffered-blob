#pragma once

#include "BufferedBlobStreamingHostObject.h"
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <functional>
#include <atomic>

namespace bufferedblob {

using namespace facebook;

/**
 * Android implementation of PlatformBridge.
 * Calls into Kotlin/Java HandleRegistry via JNI to perform streaming operations.
 * Uses a bounded thread pool for read/write/flush; downloads use dedicated threads.
 */
class AndroidPlatformBridge : public PlatformBridge {
public:
  AndroidPlatformBridge(JNIEnv* env);
  ~AndroidPlatformBridge() override;


  void readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError
  ) override;

  void write(
    int handleId,
    std::vector<uint8_t> data,
    std::function<void(int)> onSuccess,
    std::function<void(std::string)> onError
  ) override;

  void flush(
    int handleId,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError
  ) override;

  void close(int handleId) override;

  void startDownload(
    int handleId,
    std::function<void(double, double, double)> onProgress,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError
  ) override;

  void cancelDownload(int handleId) override;

  ReaderInfo getReaderInfo(int handleId) override;
  WriterInfo getWriterInfo(int handleId) override;

private:
  JavaVM* vm_;
  jclass bridgeClass_{nullptr};

  // Thread pool for read/write/flush (not downloads)
  static constexpr size_t kPoolThreads = 4;
  std::vector<std::thread> poolWorkers_;
  std::queue<std::function<void()>> taskQueue_;
  std::mutex queueMutex_;
  std::condition_variable queueCV_;
  std::atomic<bool> shutdown_{false};

  void initThreadPool();
  void submitTask(std::function<void()> task);
};

} // namespace bufferedblob
