# react-native-buffered-blob

<p align="center">
  <i>No more OOM, just use buffered-blob</i>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-buffered-blob"><img src="https://img.shields.io/npm/v/react-native-buffered-blob" alt="npm (buffered-blob)" /></a>
  <a href="https://www.npmjs.com/package/react-native-nitro-buffered-blob"><img src="https://img.shields.io/npm/v/react-native-nitro-buffered-blob" alt="npm (nitro-buffered-blob)" /></a>
  <a href="https://github.com/l2hyunwoo/react-native-nitro-blob/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg" alt="Platform: iOS | Android" />
</p>

## Requirements

| Requirement  | Minimum                                  |
| ------------ | ---------------------------------------- |
| React Native | >= 0.76.0                                |
| Architecture | New Architecture (Fabric / TurboModules) |
| iOS          | Swift (Xcode 15+)                        |
| Android      | Kotlin (AGP 8+)                          |

## Highlights

Traditional file I/O libraries load entire files into JavaScript memory as base64 strings, causing Out-Of-Memory crashes on large files. **react-native-buffered-blob** solves this with chunked streaming — files are read and written in small buffers (default 64KB, configurable up to 4MB), so memory usage stays constant regardless of file size.

- **Buffered Streaming** — Read and write files in chunks via `createReader` / `createWriter`. Default 64KB buffer, configurable from 4KB to 4MB.
- **Download with Progress** — Download files with real-time progress callbacks and cancellation support.
- **File Operations** — Full filesystem API: `exists`, `stat`, `unlink`, `mkdir`, `ls`, `cp`, `mv`.
- **File Hashing** — Compute SHA-256 or MD5 hashes without reading files into JS memory.
- **Two Flavors** — Choose between Turbo Module (zero extra deps, RN >= 0.76) or Nitro Module (for Nitro-based projects).
- **Typed Errors** — Structured `BlobError` with typed `ErrorCode` enum for reliable error handling.

## Installation

This library ships as two packages. Pick the one that matches your project:

### Turbo Module

Standalone package using Turbo Modules + JSI. No extra native dependencies.

```sh
yarn add react-native-buffered-blob
# or
npm install react-native-buffered-blob
```

```sh
cd ios && pod install
```

### Nitro Module

Uses [Nitro Modules](https://nitro.margelo.com/) with HybridObjects. For projects already using the Nitro ecosystem.

```sh
yarn add react-native-nitro-buffered-blob react-native-nitro-modules
# or
npm install react-native-nitro-buffered-blob react-native-nitro-modules
```

```sh
cd ios && pod install
```

### Comparison

|                    | `react-native-buffered-blob`  | `react-native-nitro-buffered-blob` |
| ------------------ | ----------------------------- | ---------------------------------- |
| Architecture       | Turbo Module + JSI HostObject | Nitro HybridObjects                |
| Extra dependencies | None                          | `react-native-nitro-modules`       |
| Min RN version     | 0.76.0                        | 0.76.0                             |

## Quick Start

All examples below use `react-native-buffered-blob`. If you chose the Nitro Module package, adjust the import accordingly.

### Reading a file in chunks

```typescript
import { createReader, Dirs, join } from 'react-native-buffered-blob';

const path = join(Dirs.document, 'large-video.mp4');
const reader = createReader(path);

while (!reader.isEOF) {
  const chunk = await reader.readNextChunk(); // ArrayBuffer | null
  if (chunk) {
    console.log(`Read ${chunk.byteLength} bytes`);
  }
}
reader.close();
```

Both `BlobReader` and `BlobWriter` implement [`Disposable`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/#using-declarations-and-explicit-resource-management), so you can use the `using` declaration for automatic cleanup:

```typescript
using reader = createReader(path);
// reader.close() is called automatically when it goes out of scope
```

### Writing a file

```typescript
import { createWriter, Dirs, join } from 'react-native-buffered-blob';

const path = join(Dirs.cache, 'output.bin');
const writer = createWriter(path);

for (const chunk of chunks) {
  await writer.write(chunk); // MUST await each write
}
await writer.flush();
writer.close();
```

> **Backpressure warning:** You MUST `await` each `write()` call before issuing the next one. Failing to await writes can cause unbounded memory growth as ArrayBuffer copies accumulate in the native queue — the exact OOM problem this library is designed to prevent.

### Downloading with progress

```typescript
import { download, Dirs, join } from 'react-native-buffered-blob';

const { promise, cancel } = download({
  url: 'https://example.com/file.zip',
  destPath: join(Dirs.download, 'file.zip'),
  onProgress: ({ progress, bytesDownloaded, totalBytes }) => {
    console.log(`${Math.round(progress * 100)}%`);
  },
});

await promise;
```

Call `cancel()` at any time to abort the download.

## API Reference

### Streaming

| Function                          | Description                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `createReader(path, bufferSize?)` | Open a file for buffered reading. Returns `BlobReader`. Default buffer: 64KB (range: 4KB–4MB). |
| `createWriter(path, append?)`     | Open a file for writing. Returns `BlobWriter`. Set `append: true` to append.                   |

```typescript
interface BlobReader extends Disposable {
  readonly fileSize: number;
  readonly bytesRead: number;
  readonly isEOF: boolean;
  readNextChunk(): Promise<ArrayBuffer | null>;
  close(): void;
}

interface BlobWriter extends Disposable {
  readonly bytesWritten: number;
  write(data: ArrayBuffer): Promise<number>;
  flush(): Promise<void>;
  close(): void;
}
```

### File Operations

| Function        | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `exists(path)`  | Check if a file or directory exists. Returns `Promise<boolean>`. |
| `stat(path)`    | Get file metadata. Returns `Promise<FileInfo>`.                  |
| `unlink(path)`  | Delete a file.                                                   |
| `mkdir(path)`   | Create a directory.                                              |
| `ls(path)`      | List directory contents. Returns `Promise<FileInfo[]>`.          |
| `cp(src, dest)` | Copy a file.                                                     |
| `mv(src, dest)` | Move or rename a file.                                           |

```typescript
interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory' | 'unknown';
  lastModified: number;
}
```

### Download

| Function            | Description                                      |
| ------------------- | ------------------------------------------------ |
| `download(options)` | Start a file download. Returns `DownloadHandle`. |

```typescript
interface DownloadOptions {
  url: string;
  destPath: string;
  headers?: Record<string, string>;
  onProgress?: (progress: DownloadProgress) => void;
}

interface DownloadHandle {
  promise: Promise<void>;
  cancel: () => void;
}

interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  progress: number; // 0.0 – 1.0
}
```

### Hashing

| Function                     | Description                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `hashFile(path, algorithm?)` | Compute file hash. Default: `sha256`. Also supports `md5`. Returns hex string. |

### Paths

**`Dirs`** — platform directory constants:

| Property        | Description            |
| --------------- | ---------------------- |
| `Dirs.document` | App document directory |
| `Dirs.cache`    | App cache directory    |
| `Dirs.temp`     | Temporary directory    |
| `Dirs.download` | Download directory     |

**Path utilities:**

| Function               | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `join(...parts)`       | Join path segments.                            |
| `dirname(path)`        | Get directory name.                            |
| `basename(path, ext?)` | Get file name, optionally stripping extension. |
| `extname(path)`        | Get file extension.                            |

## Error Handling

All operations throw `BlobError` with a typed `code` property:

```typescript
import { BlobError, ErrorCode } from 'react-native-buffered-blob';

try {
  await stat('/nonexistent');
} catch (e) {
  if (e instanceof BlobError) {
    console.log(e.code); // 'FILE_NOT_FOUND'
    console.log(e.message); // "No such file or directory"
    console.log(e.path); // "/nonexistent"
  }
}
```

| Code                  | Description                                        |
| --------------------- | -------------------------------------------------- |
| `FILE_NOT_FOUND`      | File or directory does not exist                   |
| `PERMISSION_DENIED`   | Insufficient permissions                           |
| `FILE_ALREADY_EXISTS` | Target already exists                              |
| `NOT_A_FILE`          | Expected a file, got a directory                   |
| `NOT_A_DIRECTORY`     | Expected a directory, got a file                   |
| `DIRECTORY_NOT_EMPTY` | Cannot remove non-empty directory                  |
| `IO_ERROR`            | Generic I/O failure                                |
| `INVALID_ARGUMENT`    | Invalid parameter (e.g., buffer size out of range) |
| `DOWNLOAD_FAILED`     | Network or server error during download            |
| `DOWNLOAD_CANCELLED`  | Download was cancelled via `cancel()`              |
| `READER_CLOSED`       | Attempted to read from a closed reader             |
| `WRITER_CLOSED`       | Attempted to write to a closed writer              |
| `UNKNOWN`             | Unclassified error                                 |

## Example Apps

Two example apps are included, both using [react-native-harness](https://github.com/nickkelly-project/react-native-harness) for on-device integration testing:

| Example      | Package                            | Directory                              |
| ------------ | ---------------------------------- | -------------------------------------- |
| Turbo Module | `react-native-buffered-blob`       | `examples/buffered-blob-example`       |
| Nitro Module | `react-native-nitro-buffered-blob` | `examples/nitro-buffered-blob-example` |

```bash
# Turbo Module example
yarn example:blob ios
yarn example:blob android

# Nitro Module example
yarn example:nitro ios
yarn example:nitro android
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) for development workflow and instructions on submitting pull requests.

## License

MIT
