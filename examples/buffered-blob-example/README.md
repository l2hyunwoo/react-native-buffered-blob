# BufferedBlobExample

Example React Native app demonstrating the `react-native-buffered-blob` JavaScript wrapper package.

## What This App Tests

This example app tests the **JS wrapper layer** (`react-native-buffered-blob`) which provides a high-level JavaScript API for file operations, streaming I/O, and downloads.

The app imports **only** from `react-native-buffered-blob` and includes comprehensive test suites for:

- File operations (read, write, copy, move, delete, stat, ls, mkdir)
- Streaming I/O (createReader, createWriter with chunked operations)
- File hashing (MD5, SHA256)
- HTTP downloads with progress tracking
- Error handling

## Running the App

### iOS

```bash
cd examples/buffered-blob-example
yarn ios
```

### Android

```bash
cd examples/buffered-blob-example
yarn android
```

## App Structure

- `src/App.tsx` - Main UI with test buttons and log display
- `src/tests/` - Comprehensive E2E test suites
  - `fileOpsTests.ts` - File system operations
  - `streamingTests.ts` - Streaming read/write
  - `hashTests.ts` - File hashing algorithms
  - `errorTests.ts` - Error handling scenarios
  - `downloadTests.ts` - HTTP download functionality

## Dependencies

- `react-native-buffered-blob` - The JS wrapper (what we're testing)
- `react-native-nitro-buffered-blob` - The native Nitro module (runtime dependency)
- `react-native-nitro-modules` - Nitro Modules runtime

Note: While this app tests the JS wrapper, it requires the native module at runtime since the wrapper delegates to native implementations.
