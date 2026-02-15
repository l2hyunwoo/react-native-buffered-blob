<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 -->

# ios/

iOS platform bridge: ObjC++ Turbo Module, Swift implementation, JSI wiring, and handle registry.

## Purpose

Implement BufferedBlob for iOS:
- **BufferedBlobModule.mm**: ObjC++ Turbo Module bridge; wires JSI HostObject via install()
- **BufferedBlobModule.swift**: Swift implementation of handle factories, FS operations, hashing with CommonCrypto
- **BufferedBlobStreamingBridge.h/mm**: IOSPlatformBridge; async dispatch via dispatch_async, NSURLSession downloads
- **HandleRegistry.swift**: Thread-safe handle storage (NSLock), maps numeric IDs to reader/writer/downloader handles
- **HandleTypes.swift**: ReaderHandleIOS, WriterHandleIOS, DownloaderHandleIOS classes
- **BufferedBlob-Bridging-Header.h**: Swift/ObjC++ interop

## Key Files

| File | Description |
|------|-------------|
| `BufferedBlobModule.mm` | RCT_EXPORT_MODULE, RCT_EXPORT_METHOD, install() calls installBufferedBlobStreaming() |
| `BufferedBlobModule.swift` | Handle factories (openRead, openWrite, createDownload), FS ops, hashFile with CommonCrypto |
| `BufferedBlobStreamingBridge.h` | IOSPlatformBridge class header; inherits from C++ PlatformBridge |
| `BufferedBlobStreamingBridge.mm` | IOSPlatformBridge implementation: dispatch_async, NSURLSession, InputStream/OutputStream |
| `HandleRegistry.swift` | Singleton: register(handle), remove(id), get(id); thread-safe with NSLock |
| `HandleTypes.swift` | ReaderHandleIOS (InputStream, fileSize, bytesRead), WriterHandleIOS (OutputStream, bytesWritten), DownloaderHandleIOS (URLSessionDataTask, URL) |
| `BufferedBlob-Bridging-Header.h` | Swift bridging header for ObjC++ classes (C++ PlatformBridge, etc.) |

## For AI Agents

### Working In This Directory

1. **ObjC++ bridge pattern**: BufferedBlobModule.mm exports methods via RCT_EXPORT_METHOD/RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD. Delegates to Swift implementation via _swiftModule.
2. **Bridged vs. Bridgeless**: install() detects RN 0.74+ bridgeless mode; falls back to RCTBridge.runtime. Both paths supported.
3. **Handle lifecycle**: Turbo Module returns numeric handle IDs. Platform bridge stores actual handle objects (reader/writer/downloader). Always close handles.
4. **Async dispatch**: File ops and downloads use `DispatchQueue.global(qos: .userInitiated)` to avoid blocking main thread. Promises resolve on main thread.
5. **CommonCrypto hashing**: Streams file in 8192-byte chunks; supports SHA256, MD5. No full file load.
6. **NSURLSession downloads**: Async, supports progress callback, cancellation. Data task delegates to DownloaderHandleIOS.

### Testing Requirements

- **Module loading**: Verify install() succeeds and JSI HostObject is accessible
- **Handle factories**: Test openRead/openWrite/createDownload with valid/invalid paths
- **File operations**: Test exists, stat, mkdir, ls, cp, mv, unlink on temp files
- **Hashing**: Verify SHA256/MD5 output matches known values (use openssl dgst to verify)
- **Streaming**: Test readNextChunk, write, flush, close; verify file contents
- **Download**: Test with HTTP server, verify progress callback, verify file written
- **Cleanup**: Verify handles are released (NSLock does not deadlock, no dangling FileHandles)

### Common Patterns

1. **Create reader**: `openRead(path, bufferSize)` → ReaderHandleIOS(path, bufferSize) → register(handle) → return handleId
2. **Stream read**: Bridge readNextChunk(handleId) → get handle → read chunk → convert to ArrayBuffer → resolve Promise
3. **Download with progress**: `createDownload(url, destPath)` → DownloaderHandleIOS → URLSession dataTask → progress callback → finalize
4. **Error handling**: Catch Foundation errors; wrap in [error localizedDescription]; reject Promise

## Dependencies

### Internal
- C++ PlatformBridge (abstract interface from cpp/)
- HandleRegistry, HandleTypes (shared state across ObjC++ and Swift)

### External
- **React Native** >= 0.76.0
  - `<React/RCTBridgeModule.h>` — RCT_EXPORT_MODULE, RCT_EXPORT_METHOD
  - `<React/RCTBridge+Private.h>` — Bridge.runtime, jsCallInvoker
  - `<ReactCommon/RCTTurboModule.h>` — TurboModule protocol
  - `<jsi/jsi.h>` — JSI runtime (passed to install())
- **Apple frameworks**
  - `Foundation/FileManager` — File operations
  - `CommonCrypto/CommonDigest.h` — SHA256, MD5 hashing
  - `Foundation/URLSession` — Downloads
  - `Foundation/InputStream, OutputStream` — Streaming

<!-- MANUAL: Document CommonCrypto vs. CryptoKit trade-offs, iOS version support (min 12.0+), URLSession configuration -->
