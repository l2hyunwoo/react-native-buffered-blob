<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# specs

## Purpose

Nitro TypeScript specification files that define HybridObject interfaces and types. These specs are processed by Nitrogen codegen to generate platform-specific C++, Swift, and Kotlin implementations.

## Key Files

| File | Description |
|------|-------------|
| `BufferedBlobModule.nitro.ts` | Main module HybridObject with stream factories, FS operations, hashing, and directory paths |
| `NativeFileReader.nitro.ts` | Reader HybridObject spec for streaming chunked file reads with ArrayBuffer transfer |
| `NativeFileWriter.nitro.ts` | Writer HybridObject spec for streaming file writes with ArrayBuffer input |
| `NativeDownloader.nitro.ts` | Downloader HybridObject spec with progress callback and cancellation support |
| `types.nitro.ts` | Shared enums (HashAlgorithm, FileType) and interfaces (FileInfo, DownloadProgress) |

## For AI Agents

### Working In This Directory

All files in this directory are Nitro TypeScript specifications. Do NOT add non-.nitro.ts files here.

**Spec workflow:**
1. Edit `.nitro.ts` file to add or modify a HybridObject interface
2. Run `yarn nitrogen` from package root to codegen C++/Swift/Kotlin
3. Implement the generated specs in `ios/` and `android/`

**Spec syntax rules:**
- Interfaces must extend `HybridObject<{ ios: 'swift'; android: 'kotlin' }>`
- Methods can return `T` (sync) or `Promise<T>` (async)
- Readonly properties become JS getters; no setters
- Parameter and return types must be serializable (primitives, interfaces, enums, ArrayBuffer)
- Enums serialize to/from native enums

### BufferedBlobModule Details

Entry point module. Provides:

**Stream Factories (sync):**
- `openRead(path: string, bufferSize: number): NativeFileReader`
- `openWrite(path: string, append: boolean): NativeFileWriter`
- `createDownload(url: string, destPath: string, headers: Record<string, string>): NativeDownloader`

**File System (async):**
- `exists(path: string): Promise<boolean>`
- `stat(path: string): Promise<FileInfo>`
- `unlink(path: string): Promise<void>` - Delete file
- `mkdir(path: string): Promise<void>` - Create directory
- `ls(path: string): Promise<FileInfo[]>` - List directory contents
- `cp(srcPath: string, destPath: string): Promise<void>` - Copy
- `mv(srcPath: string, destPath: string): Promise<void>` - Move/rename

**Hashing (async):**
- `hashFile(path: string, algorithm: HashAlgorithm): Promise<string>` - Returns hex digest string

**Directory Paths (readonly properties):**
- `documentDir: string` - App Documents directory
- `cacheDir: string` - App Cache directory
- `tempDir: string` - Temporary directory
- `downloadDir: string` - Downloads directory

### NativeFileReader Details

Streaming reader interface. Properties:
- `fileSize: Int64` - Total file size in bytes
- `bytesRead: Int64` - Bytes read so far
- `isEOF: boolean` - True when end-of-file reached

Methods:
- `readNextChunk(): Promise<ArrayBuffer | undefined>` - Returns next chunk or undefined on EOF
- `close(): void` - Close the file handle

Consumer pattern:
```typescript
const reader = module.openRead('/path/to/file', 65536); // 64KB chunks
let chunk: ArrayBuffer | undefined;
while ((chunk = await reader.readNextChunk()) !== undefined) {
  // Process chunk
}
reader.close();
```

### NativeFileWriter Details

Streaming writer interface. Properties:
- `bytesWritten: Int64` - Bytes written so far

Methods:
- `write(data: ArrayBuffer): Promise<Int64>` - Write chunk, returns bytes written
- `flush(): Promise<void>` - Sync to disk
- `close(): void` - Close the file handle

Consumer pattern:
```typescript
const writer = module.openWrite('/path/to/file', false); // false = overwrite, true = append
const chunk = new ArrayBuffer(1024);
// ... fill chunk ...
const written = await writer.write(chunk);
await writer.flush();
writer.close();
```

### NativeDownloader Details

Download manager interface. Properties:
- `isCancelled: boolean` - True if download was cancelled

Methods:
- `start(onProgress: (progress: DownloadProgress) => void): Promise<void>` - Start download with progress callback
- `cancel(): void` - Cancel the download

Progress callback receives `DownloadProgress`:
```typescript
interface DownloadProgress {
  bytesDownloaded: Int64;
  totalBytes: Int64;
  progress: number; // 0 to 1
}
```

Consumer pattern:
```typescript
const downloader = module.createDownload(
  'https://example.com/file.zip',
  '/path/to/dest',
  { 'User-Agent': 'MyApp/1.0' }
);
await downloader.start((progress) => {
  console.log(`${Math.round(progress.progress * 100)}%`);
});
```

### Types Details

**HashAlgorithm enum:**
- `SHA256` - SHA-256 hash
- `MD5` - MD5 hash (legacy; prefer SHA256)

**FileType enum:**
- `FILE` - Regular file
- `DIRECTORY` - Directory
- `UNKNOWN` - Unknown type

**FileInfo interface:**
```typescript
interface FileInfo {
  path: string;           // Absolute path
  name: string;           // Filename only
  size: Int64;            // File size in bytes
  type: FileType;         // FILE, DIRECTORY, or UNKNOWN
  lastModified: number;   // Unix timestamp in milliseconds
}
```

**DownloadProgress interface:**
```typescript
interface DownloadProgress {
  bytesDownloaded: Int64; // Bytes received so far
  totalBytes: Int64;      // Total expected bytes
  progress: number;       // 0 to 1 (may be 0 if totalBytes unknown)
}
```

## Dependencies

### Internal
None.

### External
- `react-native-nitro-modules` - Provides `HybridObject` base type and `Int64` type

## Nitrogen Codegen

After editing `.nitro.ts` files, run `yarn nitrogen` to generate:
- `nitrogen/generated/shared/c++/` - Platform-agnostic C++ specs (Hybrid*Spec.hpp/cpp)
- `nitrogen/generated/ios/c++/` and `nitrogen/generated/ios/swift/` - Swift bridge and protocols
- `nitrogen/generated/android/c++/` and `nitrogen/generated/android/kotlin/` - JNI bridge and Kotlin specs

**NEVER edit generated files**. Instead, modify the `.nitro.ts` spec and re-run `yarn nitrogen`.

<!-- MANUAL: Add any design patterns or best practices for specs in this project. -->
