<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 -->

# src/api/

High-level convenience APIs for file operations, streaming, hashing, and downloads.

## Purpose

Provide idiomatic TypeScript wrappers around Turbo Module calls and JSI HostObject streaming:
- **File operations**: exists, stat, mkdir, ls, cp, mv, unlink
- **Streaming**: readFile (deprecated), writeFile (deprecated)
- **Hashing**: hashFile with streaming (SHA256, MD5)
- **Downloads**: download with progress callback

## Key Files

| File | Description |
|------|-------------|
| `fileOps.ts` | FS operations: exists, stat, mkdir, ls, cp, mv, unlink. All return Promises. |
| `hash.ts` | hashFile(path, algorithm) → Promise<string>. Streams file; supports 'sha256', 'md5'. |
| `download.ts` | download(options) → Promise<void>. Returns DownloadOptions interface, handles progress callback. |
| `readFile.ts` | DEPRECATED: createReader(path, bufferSize) → BlobReader. Use openRead() + wrapReader() directly. |
| `writeFile.ts` | DEPRECATED: createWriter(path, append) → BlobWriter. Use openWrite() + wrapWriter() directly. |

## For AI Agents

### Working In This Directory

1. **File operations**: All async. Return Promises that resolve/reject with platform-specific error codes.
2. **Streaming shortcuts**: readFile/writeFile are deprecated convenience wrappers. New code should use `openRead()` + `wrapReader()` directly for explicit handle management.
3. **Download pattern**: `download()` creates handle, calls JSI streaming startDownload, manages progress callback, cleans up handle in finally block.
4. **Error handling**: Use `wrapError()` from parent module to normalize native errors.
5. **Handle lifecycle**: Always close streaming handles (readFile/writeFile do this implicitly; direct handle usage requires explicit close).

### Testing Requirements

- **File ops**: Create temp files, test exists/stat/mkdir/ls/cp/mv/unlink
- **Hashing**: Verify hash output against known digests (sha256, md5)
- **Download**: Test with HTTP server, verify progress callback fires, verify file written
- **Error cases**: Test file not found, permission denied, invalid paths, cancelled downloads

### Common Patterns

1. **Check file exists**: `const exists = await exists(path)`
2. **Get file info**: `const info = await stat(path)` → {path, name, size, type, lastModified}
3. **List directory**: `const files = await ls(dirPath)` → FileInfo[]
4. **Copy file**: `await cp(srcPath, destPath)`
5. **Hash file**: `const hash = await hashFile(path, 'sha256')`
6. **Download with progress**: `await download({ url, destPath, headers: {}, onProgress: (p) => console.log(p.progress) })`

## Dependencies

### Internal
- `../module.ts` — NativeModule, getStreamingProxy()
- `../types.ts` — BlobReader, BlobWriter, FileInfo, DownloadProgress, HashAlgorithm
- `../errors.ts` — wrapError()

### External
- **React Native** >= 0.76.0 (TurboModuleRegistry for NativeModule calls)

<!-- MANUAL: Document deprecated APIs, migration guides for readFile/writeFile users -->
