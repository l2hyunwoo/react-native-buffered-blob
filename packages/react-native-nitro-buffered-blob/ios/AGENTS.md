<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# ios

## Purpose

Swift implementations of HybridObject interfaces for React Native Nitro module. Provides buffered file I/O, file system operations, hashing, and downloads on iOS using Foundation framework APIs.

## Key Files

| File | Description |
|------|-------------|
| `HybridBufferedBlobModule.swift` | Main module implementation with stream factories, FS ops, hashing, and directory paths |
| `HybridNativeFileReader.swift` | InputStream-based chunked reader with configurable buffer size |
| `HybridNativeFileWriter.swift` | OutputStream-based buffered writer with auto-flushing |
| `HybridNativeDownloader.swift` | URLSession-based downloader with progress callbacks and cancellation |

## For AI Agents

### Working In This Directory

Each file implements a HybridObject interface defined in `src/specs/*.nitro.ts`. Implementations use Foundation framework APIs:

- **File I/O**: InputStream, OutputStream for streaming operations
- **File System**: FileManager for file operations and metadata
- **Hashing**: CommonCrypto for SHA256/MD5
- **Downloads**: URLSession with URLSessionDownloadDelegate

### HybridBufferedBlobModule Implementation

Entry point module. Implementation provides:

**Stream Factories:**
- `openRead(path, bufferSize)` - Creates InputStream wrapper
- `openWrite(path, append)` - Creates OutputStream wrapper
- `createDownload(url, destPath, headers)` - Creates URLSession task wrapper

**File System Operations:**
- `exists(path)` - FileManager.fileExists()
- `stat(path)` - FileManager.attributesOfItem(), marshals to FileInfo
- `unlink(path)` - FileManager.removeItem()
- `mkdir(path)` - FileManager.createDirectory()
- `ls(path)` - FileManager.contentsOfDirectory(), maps each to FileInfo
- `cp(srcPath, destPath)` - FileManager.copyItem()
- `mv(srcPath, destPath)` - FileManager.moveItem()

**Hashing:**
- `hashFile(path, algorithm)` - Streams file through CommonCrypto CCCryptoDigest, returns hex string

**Directory Properties:**
- `documentDir` - FileManager.urls(.documentDirectory).first
- `cacheDir` - FileManager.urls(.cachesDirectory).first
- `tempDir` - NSTemporaryDirectory()
- `downloadDir` - FileManager.urls(.downloadsDirectory).first

**Error Handling:**
- FileManager errors (NSError) marshal to Promise rejections
- Path validation before operations
- Permission checks via FileManager capabilities

### HybridNativeFileReader Implementation

Wraps InputStream for chunked reads. Properties:
- `fileSize` - Obtained once via FileManager attributes
- `bytesRead` - Tracked incrementally
- `isEOF` - Set to true when read returns 0 bytes

Methods:
- `readNextChunk()` - Returns promise that resolves with ArrayBuffer or undefined (EOF)
- `close()` - Closes InputStream

Implementation details:
- Opens InputStream on init
- Buffer size set by consumer (typically 64KB)
- Allocates UnsafeMutablePointer for native read, wraps in Data/ArrayBuffer
- Handles partial reads (less than buffer size)
- Returns undefined on EOF (0 bytes read)

### HybridNativeFileWriter Implementation

Wraps OutputStream for buffered writes. Properties:
- `bytesWritten` - Tracked incremental count

Methods:
- `write(data)` - Extracts bytes from ArrayBuffer, writes to stream
- `flush()` - Calls stream.close() to flush to disk (streams auto-flush on close)
- `close()` - Closes OutputStream

Implementation details:
- Opens OutputStream on init (append mode controlled)
- Converts ArrayBuffer to Data for writing
- Returns promised Int64 of bytes written
- Handles partial writes (retries if OutputStream doesn't accept all bytes)

### HybridNativeDownloader Implementation

Downloads via URLSession with progress tracking. Properties:
- `isCancelled` - Set when cancel() called or download finishes/fails

Methods:
- `start(onProgress)` - Returns promise that resolves on completion
- `cancel()` - Cancels URLSessionDownloadTask

Implementation details:
- Creates URLSessionDownloadDelegate subclass to track progress
- Invokes onProgress callback with bytesDownloaded, totalBytes, progress (0-1)
- Copies downloaded file to destPath on completion
- Handles network errors and permission errors
- Progress callback called on main thread (use DispatchQueue if needed)

### Swift/Nitro Integration

Generated files in `nitrogen/generated/ios/swift/` define:
- Spec protocols (HybridBufferedBlobModuleSpec, etc.)
- Type bridges (FileInfo, FileType, HashAlgorithm, DownloadProgress as Swift structs)
- Callback bridges (Func_void_DownloadProgress for onProgress callback)

Implementation classes adopt generated spec protocols and bridge types.

### Common Patterns

**Streaming large files:**
Use `openRead()` with appropriate buffer size (64KB-1MB) to avoid memory spikes.

**Directory path operations:**
All paths are absolute; resolve relative paths via directory properties first.

**Error handling:**
Wrap FileManager calls in try-catch, map NSError to Promise rejections with meaningful messages.

**Memory management:**
Close streams promptly; don't hold readers/writers longer than necessary.

## Dependencies

### Internal
- Generated Nitrogen specs in `nitrogen/generated/ios/swift/`

### External
- **Foundation**: FileManager, InputStream, OutputStream, FileURL, NSTemporaryDirectory
- **CommonCrypto**: CC_SHA256, CC_MD5 for hashing (linked via CocoaPods)
- **URLKit**: URLSession, URLSessionDownloadDelegate for downloads
- **React-jsi**: (linked by Nitro runtime)
- **React-callinvoker**: (linked by Nitro runtime)

## Build Notes

- Built via CocoaPods in parent repo's podspec
- Podspec auto-includes `ios/**/*.swift` and `ios/**/*.m` files
- Generated Nitrogen files auto-linked via `nitrogen/generated/ios/NitroBufferedBlob+autolinking.rb`
- Swift deployment target inherited from parent project (typically iOS 13+)

## Testing Notes

- No unit tests at this layer; integration tests via React Native app
- Manual testing: create NativeFileReader/Writer, verify data integrity
- Test large files (>100MB) to ensure streaming doesn't OOM
- Test concurrent readers/writers (each should use separate instances)

<!-- MANUAL: Add platform-specific issues, workarounds, or optimization notes here. -->
