<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 -->

# src/

TypeScript API layer: Turbo Module spec, native module interface, streaming proxy, and high-level file operations.

## Purpose

Provides the JavaScript interface to the native BufferedBlob module:
- **Turbo Module specification** (NativeBufferedBlob.ts) — codegen input for handle factories and FS ops
- **Streaming proxy** (module.ts) — JSI HostObject accessor, install() wiring
- **Type wrappers** (types.ts) — BlobReader/BlobWriter interfaces with property proxying
- **Error handling** (errors.ts) — ErrorCode enum and wrapError() utility
- **Paths** (paths.ts) — Dirs constants and path utilities

## Key Files

| File | Description |
|------|-------------|
| `NativeBufferedBlob.ts` | Turbo Module spec: install(), handle factories, FS ops, hashFile. Codegen input. |
| `module.ts` | NativeModule (TurboModuleRegistry), StreamingProxy interface, getStreamingProxy() |
| `types.ts` | HashAlgorithm, FileType enums; FileInfo, BlobReader, BlobWriter interfaces; wrapReader/wrapWriter |
| `errors.ts` | BlobError class, ErrorCode enum, wrapError() helper |
| `paths.ts` | Dirs constants (documentDir, cacheDir, tempDir, downloadDir); join(), dirname(), basename(), extname() |
| `index.ts` | Barrel exports for public API |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `api/` | High-level file operations, download, hashing, streaming wrappers |

## For AI Agents

### Working In This Directory

1. **Turbo Module spec**: Changes to `NativeBufferedBlob.ts` trigger codegen. After editing, run `yarn prepare` to regenerate native module headers.
2. **Streaming proxy access**: `getStreamingProxy()` returns the JSI HostObject installed by native code. Always call `NativeModule.install()` first (done in module.ts).
3. **Handle pattern**: Turbo Module returns numeric handles. Pass to streaming proxy methods. Always close handles to release native resources.
4. **Type safety**: Use strict TypeScript. BlobReader/BlobWriter are interface wrappers; do NOT spread HostObject properties (getters would be lost).
5. **Error propagation**: Catch errors from native calls; use `wrapError()` to normalize error messages.

### Testing Requirements

- **Type checking**: Verify no TypeScript errors in strict mode
- **Module loading**: Verify `install()` succeeds and JSI HostObject is wired
- **Handle cleanup**: Verify handles are closed; no dangling native resources
- **Error cases**: Test file not found, invalid paths, invalid buffer sizes, cancelled operations

### Common Patterns

1. **Create reader**: `const handle = NativeModule.openRead(path, bufferSize)` -> `const reader = wrapReader(handle, proxy)` -> `reader.readNextChunk()` -> `reader.close()`
2. **Create writer**: `const handle = NativeModule.openWrite(path, append)` -> `const writer = wrapWriter(handle, proxy)` -> `writer.write(data)` -> `writer.flush()` -> `writer.close()`
3. **File ops**: `exists()`, `stat()`, `mkdir()`, `ls()`, `cp()`, `mv()`, `unlink()` all return Promises
4. **Hash file**: `hashFile(path, 'sha256' | 'md5')` streams file without loading into memory
5. **Download with progress**: Use `download({ url, destPath, onProgress })` API; streaming proxy handles details

## Dependencies

### Internal
- Turbo Module spec generated from `NativeBufferedBlob.ts` at build time
- `module.ts` calls `install()` on first import (side effect)
- `api/` layer depends on NativeModule and getStreamingProxy()

### External
- **React Native** >= 0.76.0 (TurboModuleRegistry, JSI)
- **TypeScript** ^5.9.2 (type checking, codegen)

<!-- MANUAL: Document API changes, Turbo Module version bumps, deprecations -->
