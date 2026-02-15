# Nitro BufferedBlob Example App

This example app demonstrates the **raw Nitro module interface** for `react-native-nitro-buffered-blob`.

## Purpose

This app tests the **native Nitro module directly** using `NitroModules.createHybridObject()`, bypassing the JavaScript wrapper layer. This is useful for:

- Testing the native Nitro module implementation
- Verifying the Nitro bindings work correctly
- Debugging native module issues
- Understanding the low-level Nitro API

## What it Tests

The app demonstrates all native Nitro module capabilities:

### File System Operations
- `exists(path)` - Check if file exists
- `stat(path)` - Get file information
- `unlink(path)` - Delete file
- `mkdir(path)` - Create directory
- `ls(path)` - List directory contents
- `cp(src, dest)` - Copy file
- `mv(src, dest)` - Move file

### File I/O Streaming
- `openRead(path, bufferSize)` - Create file reader
- `readNextChunk()` - Read data chunks
- `openWrite(path, append)` - Create file writer
- `write(data)` - Write data chunks
- `flush()` - Flush buffers

### File Hashing
- `hashFile(path, algorithm)` - Calculate file hash (MD5, SHA1, SHA256, SHA512)

### Downloads
- `createDownload(url, dest, headers)` - Create downloader
- `start(onProgress)` - Start download with progress callbacks
- `cancel()` - Cancel download

### Directory Properties
- `documentDir` - Documents directory path
- `cacheDir` - Cache directory path
- `tempDir` - Temporary directory path
- `downloadDir` - Downloads directory path

## Running the App

### iOS
```bash
npm run ios
# or
npm run build:ios
```

### Android
```bash
npm run android
# or
npm run build:android
```

## Implementation Details

This example uses the Nitro module directly:

```typescript
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';

const nitroModule = NitroModules.createHybridObject<BufferedBlobModule>(
  'BufferedBlobModule'
);

// Use the module
const exists = await nitroModule.exists('/path/to/file');
const reader = nitroModule.openRead('/path/to/file', 4096);
```

This is different from the main example app which uses the JavaScript wrapper (`BufferedBlob` class).

## Comparison with Main Example

- **Main example** (`/example`) - Uses the high-level JavaScript API (`react-native-buffered-blob`)
- **This example** - Uses the low-level Nitro module API (`react-native-nitro-buffered-blob`)

Both test the same underlying native implementation but at different abstraction levels.
