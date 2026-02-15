#include "BufferedBlobStreamingHostObject.h"
#include <ReactCommon/TurboModuleUtils.h>
#include <cmath>
#include <string>
#include <utility>

namespace bufferedblob {

static int safeHandleId(const facebook::jsi::Value& val) {
  double d = val.asNumber();
  if (std::isnan(d) || std::isinf(d) || d < 0 || d > 2147483647.0) {
    return -1;  // Invalid handle ID, will be not-found in registry
  }
  return static_cast<int>(d);
}

using namespace facebook;

// --- OwnedMutableBuffer ---

OwnedMutableBuffer::OwnedMutableBuffer(std::vector<uint8_t> data)
    : data_(std::move(data)) {}

size_t OwnedMutableBuffer::size() const {
  return data_.size();
}

uint8_t* OwnedMutableBuffer::data() {
  return data_.data();
}

// --- BufferedBlobStreamingHostObject ---

BufferedBlobStreamingHostObject::BufferedBlobStreamingHostObject(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> callInvoker,
    std::shared_ptr<PlatformBridge> bridge)
    : runtime_(runtime),
      callInvoker_(std::move(callInvoker)),
      bridge_(std::move(bridge)),
      alive_(std::make_shared<std::atomic<bool>>(true)) {}

BufferedBlobStreamingHostObject::~BufferedBlobStreamingHostObject() {
  *alive_ = false;
}

std::vector<jsi::PropNameID> BufferedBlobStreamingHostObject::getPropertyNames(
    jsi::Runtime& rt) {
  std::vector<jsi::PropNameID> names;
  names.push_back(jsi::PropNameID::forAscii(rt, "readNextChunk"));
  names.push_back(jsi::PropNameID::forAscii(rt, "write"));
  names.push_back(jsi::PropNameID::forAscii(rt, "flush"));
  names.push_back(jsi::PropNameID::forAscii(rt, "close"));
  names.push_back(jsi::PropNameID::forAscii(rt, "startDownload"));
  names.push_back(jsi::PropNameID::forAscii(rt, "cancelDownload"));
  names.push_back(jsi::PropNameID::forAscii(rt, "getReaderInfo"));
  names.push_back(jsi::PropNameID::forAscii(rt, "getWriterInfo"));
  return names;
}

jsi::Value BufferedBlobStreamingHostObject::get(
    jsi::Runtime& rt,
    const jsi::PropNameID& name) {
  auto propName = name.utf8(rt);

  // --- readNextChunk(handleId): Promise<ArrayBuffer | null> ---
  if (propName == "readNextChunk") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "readNextChunk requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          auto callInvoker = callInvoker_;
          auto bridge = bridge_;
          auto alive = alive_;

          return react::createPromiseAsJSIValue(
              rt,
              [handleId, callInvoker, bridge, alive](
                  jsi::Runtime& rt2,
                  std::shared_ptr<react::Promise> promise) {
                bridge->readNextChunk(
                    handleId,
                    // onSuccess: data available
                    [callInvoker, promise, rtPtr = &rt2, alive](std::vector<uint8_t> data) {
                      callInvoker->invokeAsync(
                          [promise, rtPtr, data = std::move(data), alive]() mutable {
                            if (!*alive) return;
                            auto buffer = std::make_shared<OwnedMutableBuffer>(
                                std::move(data));
                            auto arrayBuffer = jsi::ArrayBuffer(
                                *rtPtr, std::move(buffer));
                            promise->resolve(std::move(arrayBuffer));
                          });
                    },
                    // onEOF: no more data
                    [callInvoker, promise, alive]() {
                      callInvoker->invokeAsync([promise, alive]() {
                        if (!*alive) return;
                        promise->resolve(jsi::Value::null());
                      });
                    },
                    // onError
                    [callInvoker, promise, alive](std::string error) {
                      callInvoker->invokeAsync(
                          [promise, error = std::move(error), alive]() {
                            if (!*alive) return;
                            promise->reject(error);
                          });
                    });
              });
        });
  }

  // --- write(handleId, data): Promise<number> ---
  if (propName == "write") {
    return jsi::Function::createFromHostFunction(
        rt, name, 2,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 2) {
            throw jsi::JSError(rt, "write requires 2 arguments");
          }
          int handleId = safeHandleId(args[0]);
          auto arrayBuffer =
              args[1].asObject(rt).getArrayBuffer(rt);
          auto dataPtr = arrayBuffer.data(rt);
          auto dataSize = arrayBuffer.size(rt);

          // Copy data since the ArrayBuffer may be GC'd
          std::vector<uint8_t> dataCopy(dataPtr, dataPtr + dataSize);

          auto callInvoker = callInvoker_;
          auto bridge = bridge_;
          auto alive = alive_;

          return react::createPromiseAsJSIValue(
              rt,
              [handleId, callInvoker, bridge, alive,
               dataCopy = std::move(dataCopy)](
                  jsi::Runtime& rt2,
                  std::shared_ptr<react::Promise> promise) {
                bridge->write(
                    handleId, std::move(dataCopy),
                    [callInvoker, promise, alive](int bytesWritten) {
                      callInvoker->invokeAsync(
                          [promise, bytesWritten, alive]() {
                            if (!*alive) return;
                            promise->resolve(jsi::Value(static_cast<double>(bytesWritten)));
                          });
                    },
                    [callInvoker, promise, alive](std::string error) {
                      callInvoker->invokeAsync(
                          [promise, error = std::move(error), alive]() {
                            if (!*alive) return;
                            promise->reject(error);
                          });
                    });
              });
        });
  }

  // --- flush(handleId): Promise<void> ---
  if (propName == "flush") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "flush requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          auto callInvoker = callInvoker_;
          auto bridge = bridge_;
          auto alive = alive_;

          return react::createPromiseAsJSIValue(
              rt,
              [handleId, callInvoker, bridge, alive](
                  jsi::Runtime& rt2,
                  std::shared_ptr<react::Promise> promise) {
                bridge->flush(
                    handleId,
                    [callInvoker, promise, alive]() {
                      callInvoker->invokeAsync([promise, alive]() {
                        if (!*alive) return;
                        promise->resolve(jsi::Value::undefined());
                      });
                    },
                    [callInvoker, promise, alive](std::string error) {
                      callInvoker->invokeAsync(
                          [promise, error = std::move(error), alive]() {
                            if (!*alive) return;
                            promise->reject(error);
                          });
                    });
              });
        });
  }

  // --- close(handleId): void (synchronous) ---
  if (propName == "close") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "close requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          bridge_->close(handleId);
          return jsi::Value::undefined();
        });
  }

  // --- startDownload(handleId, onProgress): Promise<void> ---
  if (propName == "startDownload") {
    return jsi::Function::createFromHostFunction(
        rt, name, 2,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 2) {
            throw jsi::JSError(rt, "startDownload requires 2 arguments");
          }
          int handleId = safeHandleId(args[0]);
          auto progressFn =
              std::make_shared<jsi::Function>(args[1].asObject(rt).asFunction(rt));
          auto callInvoker = callInvoker_;
          auto bridge = bridge_;
          auto alive = alive_;
          // Capture runtime pointer for use in progress callback.
          // Safe because invokeAsync runs on JS thread where runtime is valid.
          jsi::Runtime* rtPtr = &rt;

          return react::createPromiseAsJSIValue(
              rt,
              [handleId, callInvoker, bridge, progressFn, rtPtr, alive](
                  jsi::Runtime& rt2,
                  std::shared_ptr<react::Promise> promise) {
                bridge->startDownload(
                    handleId,
                    // onProgress callback - invoke on JS thread
                    [callInvoker, progressFn, rtPtr, alive](
                        double bytesDownloaded, double totalBytes,
                        double progress) {
                      callInvoker->invokeAsync(
                          [progressFn, rtPtr, bytesDownloaded, totalBytes,
                           progress, alive]() {
                            if (!*alive) return;
                            progressFn->call(
                                *rtPtr,
                                jsi::Value(bytesDownloaded),
                                jsi::Value(totalBytes),
                                jsi::Value(progress));
                          });
                    },
                    // onSuccess
                    [callInvoker, promise, alive]() {
                      callInvoker->invokeAsync([promise, alive]() {
                        if (!*alive) return;
                        promise->resolve(jsi::Value::undefined());
                      });
                    },
                    // onError
                    [callInvoker, promise, alive](std::string error) {
                      callInvoker->invokeAsync(
                          [promise, error = std::move(error), alive]() {
                            if (!*alive) return;
                            promise->reject(error);
                          });
                    });
              });
        });
  }

  // --- cancelDownload(handleId): void (synchronous) ---
  if (propName == "cancelDownload") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "cancelDownload requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          bridge_->cancelDownload(handleId);
          return jsi::Value::undefined();
        });
  }

  // --- getReaderInfo(handleId): { fileSize, bytesRead, isEOF } (synchronous) ---
  if (propName == "getReaderInfo") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "getReaderInfo requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          auto info = bridge_->getReaderInfo(handleId);
          auto obj = jsi::Object(rt);
          obj.setProperty(rt, "fileSize", info.fileSize);
          obj.setProperty(rt, "bytesRead", info.bytesRead);
          obj.setProperty(rt, "isEOF", info.isEOF);
          return obj;
        });
  }

  // --- getWriterInfo(handleId): { bytesWritten } (synchronous) ---
  if (propName == "getWriterInfo") {
    return jsi::Function::createFromHostFunction(
        rt, name, 1,
        [this](jsi::Runtime& rt, const jsi::Value&,
               const jsi::Value* args, size_t count) -> jsi::Value {
          if (count < 1) {
            throw jsi::JSError(rt, "getWriterInfo requires 1 argument");
          }
          int handleId = safeHandleId(args[0]);
          auto info = bridge_->getWriterInfo(handleId);
          auto obj = jsi::Object(rt);
          obj.setProperty(rt, "bytesWritten", info.bytesWritten);
          return obj;
        });
  }

  return jsi::Value::undefined();
}

void BufferedBlobStreamingHostObject::install(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> callInvoker,
    std::shared_ptr<PlatformBridge> bridge) {
  auto hostObject = std::make_shared<BufferedBlobStreamingHostObject>(
      runtime, std::move(callInvoker), std::move(bridge));
  auto object = jsi::Object::createFromHostObject(runtime, hostObject);
  runtime.global().setProperty(
      runtime, "__BufferedBlobStreaming", std::move(object));
}

} // namespace bufferedblob
