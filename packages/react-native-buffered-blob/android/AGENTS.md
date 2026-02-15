<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 -->

# android/

Android platform bridge: Kotlin Turbo Module, JNI bridge, streaming operations, and handle registry.

## Purpose

Implement BufferedBlob for Android:
- **BufferedBlobModule.kt**: Turbo Module class extending NativeBufferedBlobSpec; handle factories, FS operations, hashing
- **BufferedBlobPackage.kt**: TurboReactPackage provider for React Native
- **HandleRegistry.kt**: Thread-safe handle storage (ConcurrentHashMap), numeric IDs via AtomicInteger
- **StreamingBridge.kt**: Static JNI-callable methods for read/write/flush/download; OkHttp enqueue() for async downloads
- **build.gradle**: CMake linking, OkHttp 4.12.0 dependency

## Key Files

| File | Description |
|------|-------------|
| `src/main/java/com/bufferedblob/BufferedBlobModule.kt` | NativeBufferedBlobSpec impl: install(), openRead, openWrite, createDownload, FS ops, hashFile |
| `src/main/java/com/bufferedblob/BufferedBlobPackage.kt` | TurboReactPackage, ReactModuleInfoProvider; returns BufferedBlobModule |
| `src/main/java/com/bufferedblob/HandleRegistry.kt` | Singleton: register(handle), remove(id), get(id); AtomicInteger counter, ConcurrentHashMap storage |
| `src/main/java/com/bufferedblob/StreamingBridge.kt` | Static JNI-callable methods: readNextChunk, write, flush, close, startDownload, cancelDownload, getReaderInfo, getWriterInfo |
| `build.gradle` | Dependencies: react-android, OkHttp; CMake pointing to cpp/CMakeLists.txt |

## For AI Agents

### Working In This Directory

1. **NativeBufferedBlobSpec**: Generated from Turbo Module spec (NativeBufferedBlob.ts). BufferedBlobModule extends it; implement all abstract methods.
2. **Coroutine scope**: Module has private CoroutineScope(Dispatchers.IO + SupervisorJob()). All async FS ops launch() on this scope. Module.invalidate() cancels scope.
3. **Handle lifecycle**: Turbo Module returns numeric handles. JNI and Kotlin static methods access handles via HandleRegistry.get(handleId).
4. **JNI bridge**: nativeInstall(jsiPtr, callInvokerHolder) is called from install(). Calls C++ install() which creates AndroidPlatformBridge.
5. **OkHttp downloads**: StreamingBridge.startDownload() uses OkHttp client.newCall(request).enqueue(callback). Calls JNI progress callback and resolve/reject.
6. **Error codes**: Return -1 for handle errors; throw RuntimeException with "[CODE]" prefix for validation errors.

### Testing Requirements

- **Module loading**: Verify install() returns true; verify system.loadLibrary("bufferedblobstreaming") succeeds
- **Handle factories**: Test openRead/openWrite/createDownload with valid/invalid paths, buffer sizes
- **File operations**: Test exists, stat, mkdir, ls, cp, mv, unlink on temp files via scope.launch
- **Hashing**: Verify SHA256/MD5 via MessageDigest.getInstance()
- **Streaming**: Test readNextChunk, write, flush, close; verify file IO
- **Download**: Test with HTTP server, verify OkHttp progress callback, verify file written
- **Cleanup**: Verify module.invalidate() cancels scope and clears handles
- **Thread safety**: Test concurrent handle access via ConcurrentHashMap

### Common Patterns

1. **Coroutine file op**: `scope.launch { try { /* do work */ promise.resolve(result) } catch (e: Exception) { promise.reject("ERR_FS", e.message) } }`
2. **Create reader**: `openRead(path, bufferSize)` → validate buffer size → FileInputStream(file) → ReaderHandle → register → return handleId
3. **Stream read**: JNI readNextChunk(handleId) → get handle → read chunk → call progress callback → call resolve callback
4. **Download**: `createDownload(url, destPath)` → DownloaderHandle(url, destPath) → register → StreamingBridge.startDownload() → OkHttp enqueue → callback chain
5. **Error codes**: Buffer size validation throws with "[INVALID_ARGUMENT]"; file not found with "[FILE_NOT_FOUND]"

## Dependencies

### Internal
- `HandleRegistry.kt` — Singleton handle storage
- `StreamingBridge.kt` — JNI static methods (called from C++)

### External
- **React Native** >= 0.76.0
  - Codegen: NativeBufferedBlobSpec (generated from src/NativeBufferedBlob.ts)
  - TurboModuleRegistry, Promise, ReactMethod, ReadableMap
- **Android SDK**
  - `java.io.File, FileInputStream, FileOutputStream` — File IO
  - `java.security.MessageDigest` — SHA256, MD5 hashing
  - `android.os.Environment` — DIRECTORY_DOWNLOADS
- **OkHttp** 4.12.0 — HTTP downloads
- **Kotlin Coroutines** — Dispatchers.IO, CoroutineScope, SupervisorJob

<!-- MANUAL: Document OkHttp configuration (timeouts, certificates), Coroutine scope lifecycle on module invalidate, JNI callback performance -->
