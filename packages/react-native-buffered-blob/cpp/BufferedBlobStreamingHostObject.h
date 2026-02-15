#pragma once

#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>
#include <memory>
#include <functional>
#include <vector>
#include <cstdint>

namespace bufferedblob {

using namespace facebook;

/**
 * Platform bridge abstraction.
 * Each platform (Android/iOS) implements this interface to provide
 * native streaming operations that the JSI HostObject delegates to.
 */
struct PlatformBridge {
  virtual ~PlatformBridge() = default;

  // Reader operations
  virtual void readNextChunk(
    int handleId,
    std::function<void(std::vector<uint8_t>)> onSuccess,
    std::function<void()> onEOF,
    std::function<void(std::string)> onError
  ) = 0;

  // Writer operations
  virtual void write(
    int handleId,
    std::vector<uint8_t> data,
    std::function<void(int)> onSuccess,
    std::function<void(std::string)> onError
  ) = 0;

  virtual void flush(
    int handleId,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError
  ) = 0;

  // Close (sync)
  virtual void close(int handleId) = 0;

  // Download operations
  virtual void startDownload(
    int handleId,
    std::function<void(double, double, double)> onProgress,
    std::function<void()> onSuccess,
    std::function<void(std::string)> onError
  ) = 0;

  virtual void cancelDownload(int handleId) = 0;

  // Reader info (sync)
  struct ReaderInfo {
    double fileSize;
    double bytesRead;
    bool isEOF;
  };
  virtual ReaderInfo getReaderInfo(int handleId) = 0;

  // Writer info (sync)
  struct WriterInfo {
    double bytesWritten;
  };
  virtual WriterInfo getWriterInfo(int handleId) = 0;
};

/**
 * JSI HostObject that exposes streaming operations to JavaScript.
 * Installed on global.__BufferedBlobStreaming by the install() method.
 */
class BufferedBlobStreamingHostObject : public jsi::HostObject {
public:
  BufferedBlobStreamingHostObject(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> callInvoker,
    std::shared_ptr<PlatformBridge> bridge
  );

  ~BufferedBlobStreamingHostObject() override;

  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override;
  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& rt) override;

  /**
   * Install the HostObject on the given runtime as global.__BufferedBlobStreaming.
   */
  static void install(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> callInvoker,
    std::shared_ptr<PlatformBridge> bridge
  );

private:
  jsi::Runtime& runtime_;
  std::shared_ptr<react::CallInvoker> callInvoker_;
  std::shared_ptr<PlatformBridge> bridge_;
  std::shared_ptr<std::atomic<bool>> alive_;
};

/**
 * MutableBuffer subclass that owns its data for zero-copy ArrayBuffer creation.
 */
class OwnedMutableBuffer : public jsi::MutableBuffer {
public:
  explicit OwnedMutableBuffer(std::vector<uint8_t> data);
  size_t size() const override;
  uint8_t* data() override;

private:
  std::vector<uint8_t> data_;
};

} // namespace bufferedblob
