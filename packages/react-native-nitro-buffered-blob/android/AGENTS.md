<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# android

## Purpose

Kotlin implementations of HybridObject interfaces for React Native Nitro module on Android. Provides buffered file I/O, file system operations, hashing, and downloads using Java/Android APIs.

## Key Files

| File | Description |
|------|-------------|
| `src/main/java/com/margelo/nitro/bufferedblob/HybridBufferedBlobModule.kt` | Main module implementation with stream factories, FS ops, hashing, directory paths |
| `src/main/java/com/margelo/nitro/bufferedblob/HybridNativeFileReader.kt` | BufferedInputStream-based chunked reader |
| `src/main/java/com/margelo/nitro/bufferedblob/HybridNativeFileWriter.kt` | BufferedOutputStream-based buffered writer |
| `src/main/java/com/margelo/nitro/bufferedblob/HybridNativeDownloader.kt` | OkHttp-based downloader with progress callbacks |
| `src/main/java/com/margelo/nitro/bufferedblob/BufferedBlobPackage.kt` | Package registration for Nitro autolinking |
| `src/main/cpp/cpp-adapter.cpp` | JNI adapter for C++ Nitrogen bridge (auto-generated files link here) |
| `build.gradle` | Gradle build configuration with Kotlin, CMake, Nitro dependencies |
| `CMakeLists.txt` | CMake configuration for building C++ Nitrogen generated code |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/main/java/com/margelo/nitro/bufferedblob/` | Kotlin HybridObject implementations |
| `src/main/cpp/` | JNI adapter and C++ integration |

## For AI Agents

### Working In This Directory

Each Kotlin file implements a HybridObject interface from `src/specs/*.nitro.ts`. Implementations use Android/Java APIs:

- **File I/O**: BufferedInputStream, BufferedOutputStream for streaming
- **File System**: File, java.nio.file.Files for operations and metadata
- **Hashing**: MessageDigest for SHA256/MD5
- **Downloads**: OkHttp for network requests, progress callbacks

### HybridBufferedBlobModule Implementation

Entry point module. Kotlin implementation provides:

**Stream Factories:**
- `openRead(path, bufferSize)` - Creates BufferedInputStream wrapper, returns HybridNativeFileReader
- `openWrite(path, append)` - Creates BufferedOutputStream wrapper, returns HybridNativeFileWriter
- `createDownload(url, destPath, headers)` - Creates OkHttp request wrapper, returns HybridNativeDownloader

**File System Operations:**
- `exists(path)` - File(path).exists()
- `stat(path)` - File(path) attributes, marshals to FileInfo struct
- `unlink(path)` - File(path).delete()
- `mkdir(path)` - File(path).mkdirs()
- `ls(path)` - File(path).listFiles(), maps each to FileInfo
- `cp(srcPath, destPath)` - java.nio.file.Files.copy()
- `mv(srcPath, destPath)` - File(srcPath).renameTo(File(destPath))

**Hashing:**
- `hashFile(path, algorithm)` - Streams file through MessageDigest, returns hex string

**Directory Properties:**
- `documentDir` - Context.getFilesDir().absolutePath
- `cacheDir` - Context.getCacheDir().absolutePath
- `tempDir` - Context.getCacheDir() or File.createTempFile() dir
- `downloadDir` - Context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS).absolutePath

**Error Handling:**
- IOException, FileNotFoundException marshal to Promise rejections
- SecurityException for permission issues
- Meaningful error messages with file paths

### HybridNativeFileReader Implementation

Wraps BufferedInputStream for chunked reads. Properties:
- `fileSize` - Obtained once via File.length()
- `bytesRead` - Tracked incrementally
- `isEOF` - Set to true when read returns -1

Methods:
- `readNextChunk()` - Returns promise that resolves with ByteArray (wrapped as ArrayBuffer) or undefined (EOF)
- `close()` - Closes BufferedInputStream

Implementation details:
- Opens BufferedInputStream on init with specified buffer size
- Allocates ByteArray (buffer size), reads into it
- Returns -1 from read() indicates EOF; return undefined
- Partial reads (less than buffer size) returned as-is
- Converts ByteArray to ArrayBuffer for JS (zero-copy transfer)

### HybridNativeFileWriter Implementation

Wraps BufferedOutputStream for buffered writes. Properties:
- `bytesWritten` - Tracked incremental count

Methods:
- `write(data)` - Accepts ArrayBuffer/ByteArray, writes to stream, returns bytes written
- `flush()` - Calls BufferedOutputStream.flush() to ensure data queued
- `close()` - Closes BufferedOutputStream (forces final flush and sync)

Implementation details:
- Opens BufferedOutputStream on init (append mode controlled)
- Converts ArrayBuffer to ByteArray for writing
- Returns promised Int64 of bytes written
- Handles exceptions from stream write operations

### HybridNativeDownloader Implementation

Downloads via OkHttp with progress tracking. Properties:
- `isCancelled` - Set when cancel() called or download completes

Methods:
- `start(onProgress)` - Executes OkHttp request, invokes onProgress periodically, returns promise
- `cancel()` - Cancels OkHttp call

Implementation details:
- Creates OkHttp Call with custom headers from request
- Implements ResponseBody.Reader to track bytes and invoke onProgress callback
- Copies response body to destPath File
- Progress callback runs on OkHttp's executor thread; marshal to main thread if needed
- Handles network errors, IO errors, HTTP errors (non-200 status)
- Cleanup: deletes partial file on cancellation/error

### Kotlin/Nitro Integration

Generated files in `nitrogen/generated/android/kotlin/` define:
- Spec interfaces (HybridBufferedBlobModuleSpec, etc.)
- Type classes (FileInfo, FileType, HashAlgorithm, DownloadProgress as data classes)
- Callback interfaces (Func_void_DownloadProgress for onProgress callback)

Implementation classes implement generated spec interfaces, extend HybridObject base, and bridge Kotlin types.

Generated C++ files in `nitrogen/generated/android/c++/` and `nitrogen/generated/android/kotlin/` provide JNI bridges; these link to `cpp-adapter.cpp`.

### Common Patterns

**Streaming large files:**
Use `openRead()` with buffer size 64KB-1MB to balance memory and throughput.

**Permissions:**
Ensure READ/WRITE_EXTERNAL_STORAGE or scoped storage permissions are granted before calling FS operations.

**Directory paths:**
Use Context helpers (getFilesDir, getCacheDir, getExternalFilesDir) rather than hardcoded /sdcard paths for better compatibility.

**Error handling:**
Wrap File/IOException operations in try-catch, convert to meaningful error messages for JS.

**Memory management:**
Close streams promptly in try-finally or use Kotlin's use() function for auto-closing.

## Dependencies

### Internal
- Generated Nitrogen specs in `nitrogen/generated/android/kotlin/`
- Generated C++ bridge in `nitrogen/generated/android/c++/`

### External
- **Java/Android**: java.io.*, java.nio.file.*, android.content.Context, Environment
- **OkHttp3**: com.squareup.okhttp3:okhttp (network requests and downloads)
- **Kotlin Stdlib**: org.jetbrains.kotlin:kotlin-stdlib
- **react-native-nitro-modules**: com.facebook:react (linked by Nitro runtime)

### Build Tools
- Gradle 8.7.2
- Kotlin 2.0.21
- Android Gradle Plugin 8.7.2
- CMake 3.22+ (for C++ build)
- NDK (r25 or later, auto-downloaded)

## Build Notes

- `build.gradle` applies Kotlin plugin, CMake integration, Nitro autolinking
- CMakeLists.txt links generated C++ Nitrogen code (nitrogen/generated/android/c++/)
- Autolinking gradle script auto-includes generated Kotlin sources
- C++ flags: -frtti -fexceptions for exception support, -O2 for release builds
- Supported ABIs: armeabi-v7a, x86, x86_64, arm64-v8a (configurable via reactNativeArchitectures)

## Testing Notes

- No unit tests at this layer; integration tests via React Native app
- Manual testing: create HybridNativeFileReader/Writer, verify data integrity
- Test large files (>100MB) on low-memory devices
- Test concurrent readers/writers (use separate instances for concurrent access)
- Test download cancellation mid-transfer
- Test with various network conditions (use proxy to simulate latency/bandwidth)

## Known Limitations

- Downloads over 2GB may overflow progress callback (use Int64 or split)
- OkHttp may require network security config on Android 9+ (handled by parent app)
- Scoped storage (Android 11+) may restrict access to certain directories

<!-- MANUAL: Add platform-specific issues, workarounds, permissions guidance here. -->
