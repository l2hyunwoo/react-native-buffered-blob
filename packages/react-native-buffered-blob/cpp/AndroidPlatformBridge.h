#pragma once

#include "BufferedBlobStreamingHostObject.h"
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>

namespace bufferedblob {

using namespace facebook;

/**
 * Android implementation of PlatformBridge.
 * Calls into Kotlin/Java HandleRegistry via JNI to perform streaming operations.
 */
class AndroidPlatformBridge : public PlatformBridge {
public:
  AndroidPlatformBridge(JNIEnv* env);

  void readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError
  ) override;

  void write(
    int handleId,
    const uint8_t* data,
    size_t size,
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
  jni::global_ref<jclass> bridgeClass_;
};

} // namespace bufferedblob
