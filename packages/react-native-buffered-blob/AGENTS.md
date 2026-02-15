<!-- Generated: 2026-02-15 -->

# react-native-buffered-blob

Turbo Module + JSI HostObject library for OOM-safe file I/O in React Native. Handles streaming read/write, file operations, hashing, and downloads with progress tracking.

## Purpose

Provide a high-performance, memory-safe file streaming API across iOS and Android without Out-Of-Memory errors. Uses:
- **Turbo Module** (TypeScript codegen) for Turbo Module calls and handle factories
- **JSI HostObject** (C++) for streaming operations with zero-copy ArrayBuffer support
- **Platform Bridges** (JNI/ObjC++) for native streaming and download logic

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo package config; codegenConfig for BufferedBlobSpec, react-native-builder-bob targets |
| `tsconfig.json` / `tsconfig.build.json` | Strict TypeScript configuration |
| `react-native.config.js` | RN linking: points to `cpp/CMakeLists.txt` |
| `react-native-buffered-blob.podspec` | CocoaPods spec for iOS linking |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript Turbo Module spec and API layer |
| `cpp/` | JSI HostObject, platform bridge abstraction, Android JNI bindings |
| `ios/` | iOS platform bridge (ObjC++ + Swift), handle registry, streaming |
| `android/` | Android platform bridge (Kotlin + JNI), handle registry, streaming |

## For AI Agents

### Working In This Directory

1. **Package structure**: Monorepo package published to npm. Use `yarn prepare` or `bob build` to generate lib/ outputs.
2. **Turbo Module spec**: Changes to `src/NativeBufferedBlob.ts` trigger codegen. Regenerate with `yarn prepare`.
3. **JSI + Platform Bridges**: C++ code in `cpp/` is platform-agnostic; each platform implements `PlatformBridge` interface.
4. **Handle pattern**: Turbo Module returns numeric handles; JSI HostObject operates on handles by ID stored in platform-specific registries.
5. **Type safety**: Use TypeScript strict mode (`tsconfig.json`). Use `wrapReader()` / `wrapWriter()` to proxy JSI HostObject properties.

### Testing Requirements

- **Type checking**: `yarn typecheck` (runs `tsc --noEmit`)
- **Unit tests**: Verify API layer functions (fileOps, hash, download) in isolation
- **Integration tests**: End-to-end streaming tests on iOS/Android (requires native build)
- **Streaming tests**: Verify zero-copy ArrayBuffer, handle cleanup, error propagation

### Common Patterns

1. **Handle-based streaming**: `openRead(path) -> handleId -> getStreamingProxy() -> readNextChunk(handleId)`. Always `close(handleId)` when done.
2. **Promises for async**: File operations return Promises; streaming is Promise-based via JSI callbacks.
3. **Error handling**: Use `wrapError()` to normalize platform-specific exceptions. Error codes in `errors.ts`.
4. **Progress callbacks**: Download progress via callback; streaming info via `getReaderInfo()` / `getWriterInfo()`.

## Dependencies

### Internal
- `src/NativeBufferedBlob.ts` — Turbo Module spec (codegen input)
- `src/module.ts` — Streaming proxy access; install() called on module import
- `src/types.ts` — BlobReader/BlobWriter interfaces, wrappers
- `src/api/` — High-level file ops, hash, download
- `cpp/` — JSI HostObject, platform bridges, Android JNI loader
- `ios/` — Swift implementation, ObjC++ bridge, handle registry
- `android/` — Kotlin implementation, JNI bridge, handle registry

### External
- **React Native** >= 0.76.0 (Turbo Module, JSI)
- **react-native-builder-bob** — Build tool for TypeScript -> lib/
- **TypeScript** ^5.9.2 — Codegen and type checking
- **iOS**: CommonCrypto (hashing), URLSession (downloads), FileManager
- **Android**: OkHttp 4.12.0 (downloads), Kotlin Coroutines, MessageDigest

<!-- MANUAL: Add platform-specific build notes, versioning, or API evolution here -->
