<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-16 -->

# react-native-buffered-blob

## Purpose
Turbo Module + JSI HostObject library for OOM-safe file I/O in React Native. Handles streaming read/write, file operations, hashing, and downloads with progress tracking. No dependency on Nitro — uses React Native's built-in Turbo Module codegen and a custom C++ JSI HostObject for streaming.

## Architecture
Two-layer native bridge:
1. **Turbo Module** (`NativeBufferedBlob.ts` codegen) — Exposes handle factories (`openRead`, `openWrite`, `createDownload`), file system operations, and constants. Returns numeric handle IDs.
2. **JSI HostObject** (`BufferedBlobStreamingHostObject` in C++) — Installed on `global.__BufferedBlobStreaming` during `install()`. Operates on handle IDs for streaming: `readNextChunk`, `write`, `flush`, `close`, `startDownload`, `cancelDownload`.

The C++ layer defines a `PlatformBridge` interface implemented by each platform (iOS via ObjC++, Android via JNI->Kotlin).

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Package config with codegenConfig for BufferedBlobSpec, builder-bob targets |
| `tsconfig.json` / `tsconfig.build.json` | Strict TypeScript configuration |
| `react-native.config.js` | RN autolinking config; points to `cpp/CMakeLists.txt` for Android |
| `react-native-buffered-blob.podspec` | CocoaPods spec for iOS linking |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript API layer, Turbo Module spec, types, wrappers (see `src/AGENTS.md`) |
| `cpp/` | C++ JSI HostObject, PlatformBridge abstraction, Android JNI (see `cpp/AGENTS.md`) |
| `ios/` | iOS native implementation in ObjC/ObjC++ (see `ios/AGENTS.md`) |
| `android/` | Android native implementation in Kotlin (see `android/AGENTS.md`) |
| `lib/` | Generated build output (do not edit) |

## For AI Agents

### Working In This Directory
1. **Build**: `yarn wrapper prepare` or `bob build` to generate `lib/` outputs
2. **Turbo Module spec**: Changes to `src/NativeBufferedBlob.ts` trigger codegen on build
3. **Handle pattern**: Turbo Module returns numeric handle IDs; JSI HostObject operates on handles via platform registries
4. **C++ PlatformBridge**: Each platform implements the `PlatformBridge` interface; C++ code in `cpp/` is shared
5. **Type safety**: Use `wrapReader()` / `wrapWriter()` to proxy JSI HostObject properties (never spread HostObjects)

### Testing Requirements
- **Type checking**: `yarn wrapper typecheck` (runs `tsc --noEmit`)
- **Unit tests**: `yarn wrapper test` — tests in `src/__tests__/` cover API wrappers, paths, errors
- **Mocks**: `src/__mocks__/NativeBufferedBlob.ts` provides a mock for the native module
- **Integration**: Build and run `examples/buffered-blob-example` on iOS/Android

### Common Patterns
1. **Handle lifecycle**: `openRead(path) -> handleId -> getStreamingProxy() -> readNextChunk(handleId) -> close(handleId)`
2. **Error handling**: All API functions use `wrapError()` to parse native `[ERROR_CODE] message` format into `BlobError`
3. **Backpressure**: `writer.write()` must be awaited sequentially — parallel writes cause unbounded memory growth
4. **Disposable**: BlobReader/BlobWriter implement `Symbol.dispose` for `using` syntax support

## Dependencies

### External
- **React Native** >= 0.76.0 (Turbo Module, JSI)
- **react-native-builder-bob** — Build tool for TypeScript -> lib/
- **iOS**: CommonCrypto (hashing), NSURLSession (downloads), NSFileManager, NSInputStream/NSOutputStream
- **Android**: OkHttp (downloads), Kotlin Coroutines (Dispatchers.IO), java.security.MessageDigest

<!-- MANUAL: -->
