<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# src

## Purpose

TypeScript source directory containing HybridObject interface specifications and barrel exports for the react-native-nitro-buffered-blob module. All `.nitro.ts` files define the contracts between JavaScript and native code.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Barrel file exporting all HybridObject types and enums for consumer packages |
| `specs/BufferedBlobModule.nitro.ts` | Main module spec with stream factories, file system ops, hashing, and directory paths |
| `specs/NativeFileReader.nitro.ts` | Streaming file reader spec with readNextChunk() for chunked reads |
| `specs/NativeFileWriter.nitro.ts` | Streaming file writer spec with write(ArrayBuffer) and flush() |
| `specs/NativeDownloader.nitro.ts` | Download manager spec with progress callback and cancellation |
| `specs/types.nitro.ts` | Shared enums and interfaces (HashAlgorithm, FileType, FileInfo, DownloadProgress) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `specs/` | HybridObject interface definitions in Nitro TypeScript format |

## For AI Agents

### Working In This Directory

Edit `.nitro.ts` files to define or modify HybridObject contracts. After editing:

1. Run `yarn nitrogen` from the package root
2. Verify generated files appear in `nitrogen/generated/`
3. Update native implementations in `ios/` and `android/` to match the new specs
4. Run `yarn typecheck` to validate TypeScript types

**File naming**: All spec files must end with `.nitro.ts` for Nitrogen to recognize them.

### Key Contracts

**BufferedBlobModule** is the entry point HybridObject. It provides:
- Stream factories: `openRead(path, bufferSize): NativeFileReader`, `openWrite(path, append): NativeFileWriter`
- File system: `exists()`, `stat()`, `unlink()`, `mkdir()`, `ls()`, `cp()`, `mv()`
- Hashing: `hashFile(path, algorithm): Promise<string>`
- Directory paths: `documentDir`, `cacheDir`, `tempDir`, `downloadDir` (readonly strings)

**NativeFileReader**: Streaming read interface with `readNextChunk(): Promise<ArrayBuffer | undefined>`. Undefined indicates EOF. Properties track `fileSize`, `bytesRead`, `isEOF`.

**NativeFileWriter**: Streaming write interface with `write(data: ArrayBuffer): Promise<Int64>` and `flush(): Promise<void>`. Tracks `bytesWritten`.

**NativeDownloader**: Download interface with `start(onProgress): Promise<void>` and `cancel()`. Progress callback receives `DownloadProgress` with `bytesDownloaded`, `totalBytes`, `progress` (0-1).

**Types**:
- `HashAlgorithm`: enum (SHA256, MD5)
- `FileType`: enum (FILE, DIRECTORY, UNKNOWN)
- `FileInfo`: interface with path, name, size, type, lastModified
- `DownloadProgress`: interface with bytesDownloaded, totalBytes, progress

### Modifying Specs

When adding or changing a spec:
1. Update the `.nitro.ts` file
2. Run `yarn nitrogen` to regenerate
3. Verify no TypeScript errors: `yarn typecheck`
4. Update native implementations (ios/*.swift and android/*.kt) to match

### Int64 and ArrayBuffer Notes

- `Int64` from react-native-nitro-modules represents 64-bit integers (file sizes, byte counts)
- `ArrayBuffer` is zero-copy transferred between JS and native
- Spec methods can be sync (return T) or async (return Promise<T>)
- Readonly properties become getters; writable properties become settable fields

## Dependencies

### Internal
None at spec level.

### External
- `react-native-nitro-modules` - Provides HybridObject base type and primitive types (Int64, etc.)
- `nitrogen` (dev) - Codegen tool that processes `.nitro.ts` files

## Build Notes

- `yarn nitrogen` runs the Nitrogen codegen tool, consuming all `.nitro.ts` files and producing platform-specific code
- TypeScript compilation happens after codegen via `bob build`
- Specs must be valid TypeScript and valid Nitro syntax (interface extending HybridObject)

<!-- MANUAL: Document any spec design decisions or patterns specific to this module. -->
