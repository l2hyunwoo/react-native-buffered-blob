<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 -->

# cpp/

JSI HostObject, platform bridge abstraction, and Android JNI loader.

## Purpose

Implements the native streaming layer:
- **BufferedBlobStreamingHostObject**: JSI HostObject class exposing streaming methods (readNextChunk, write, flush, close, startDownload, etc.)
- **PlatformBridge**: Abstract interface that iOS and Android implement for actual streaming logic
- **OwnedMutableBuffer**: Zero-copy ArrayBuffer helper for JSI
- **jni_onload.cpp**: Android JNI entry point that installs the HostObject
- **AndroidPlatformBridge**: Android implementation of PlatformBridge using JNI callbacks to Kotlin

## Key Files

| File | Description |
|------|-------------|
| `BufferedBlobStreamingHostObject.h` | PlatformBridge interface (abstract), BufferedBlobStreamingHostObject class, OwnedMutableBuffer |
| `BufferedBlobStreamingHostObject.cpp` | JSI property handlers, Promise creation via callInvoker->invokeAsync, error handling |
| `AndroidPlatformBridge.h` | Android implementation header: inherits PlatformBridge, calls JNI static methods |
| `AndroidPlatformBridge.cpp` | JNI implementation: FindClass, GetStaticMethodID, uses std::thread::detach for async ops |
| `jni_onload.cpp` | Java_com_bufferedblob_BufferedBlobModule_nativeInstall: extracts JSI runtime, CallInvoker, creates bridge, calls install() |
| `CMakeLists.txt` | CMake build config: links ReactAndroid::jsi, react_nativemodule_core, turbomodulejsijni, fbjni |

## For AI Agents

### Working In This Directory

1. **Platform abstraction**: PlatformBridge is the abstraction layer. iOS and Android each implement it independently. Changes to PlatformBridge interface require updates to both platforms.
2. **JSI property handlers**: BufferedBlobStreamingHostObject::get() maps property names to methods. Methods are exposed as Properties or Functions in the HostObject.
3. **Promise pattern**: Use `react::createPromiseAsJSIValue(rt, asyncFn, callInvoker)` to return Promises to JavaScript. Callbacks invoke `resolve()` or `reject()` with JSI values.
4. **ArrayBuffer zero-copy**: OwnedMutableBuffer owns the data vector; returned as jsi::MutableBuffer to avoid copying.
5. **Android JNI**: nativeInstall() is called from Kotlin BufferedBlobModule.install(). Extracts JSI runtime pointer and CallInvoker, creates AndroidPlatformBridge, installs HostObject.
6. **Error handling**: PlatformBridge callbacks (onSuccess, onError) pass strings to the HostObject, which converts them to JSI errors.

### Testing Requirements

- **Compile without errors**: C++ code compiles with clang, including JSI headers
- **CMake linking**: Verify CMakeLists.txt links all required libraries (jsi, react_nativemodule_core, fbjni on Android)
- **Android linking**: Verify nativeInstall() JNI signature matches Kotlin method
- **Property access**: Verify JSI HostObject properties are accessible from JavaScript
- **Promise resolution**: Verify async callbacks resolve/reject Promises correctly
- **Zero-copy**: Verify ArrayBuffer does not copy data (requires profiling)

### Common Patterns

1. **Create Promise**: `react::createPromiseAsJSIValue(rt, [](jsi::Runtime& r, std::function<void(jsi::Value)> resolve, std::function<void(jsi::Runtime&, jsi::Error)> reject) { ... }, callInvoker_)`
2. **Get string property**: `rt.getPropertyAsFunction(rt, name).call(rt, args...)`
3. **Call PlatformBridge async**: `bridge_->readNextChunk(handleId, [=](std::vector<uint8_t> data) { ... }, ...)`
4. **Return Promises**: Store resolve/reject lambdas; call from platform bridge callbacks
5. **Convert to ArrayBuffer**: `rt.createArrayBuffer(std::make_shared<OwnedMutableBuffer>(data))`

## Dependencies

### Internal
- `BufferedBlobStreamingHostObject.h` — PlatformBridge interface
- Android: `AndroidPlatformBridge.h` — JNI to Kotlin static methods

### External
- **React Native** >= 0.76.0
  - `<jsi/jsi.h>` — JSI runtime, HostObject, Value, MutableBuffer
  - `<ReactCommon/CallInvoker.h>` — CallInvoker for Promise creation
  - `<ReactCommon/TurboModuleManagerDelegate.h>` (Android) — Turbo Module integration
- **Android**
  - `<fbjni/fbjni.h>` — Facebook JNI helpers (jni::make_local, etc.)
  - `<android/log.h>` (optional) — Logging

<!-- MANUAL: Document JSI best practices, Promise handling guidelines, Android/iOS bridge API versioning -->
