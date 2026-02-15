<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# example

## Purpose
React Native example app demonstrating the buffered blob libraries.

## Key Files
| File | Description |
|------|-------------|
| `src/App.tsx` | Main app — file test suite + download test with streaming APIs |
| `package.json` | RN 0.83, workspace deps on both library packages |
| `metro.config.js` | Metro bundler config for monorepo resolution |
| `react-native.config.js` | RN CLI config |
| `babel.config.js` | Babel config |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | App source code |
| `ios/` | Xcode project (NitroBlobExample) |
| `android/` | Gradle project |

## For AI Agents

### Working In This Directory
- This app imports from `react-native-buffered-blob` — only streaming APIs (createReader, createWriter, download with options)
- No `readFile`/`writeFile` convenience methods exist — use streaming patterns only
- The download API uses options object: `download({ url, destPath, onProgress })`
- Build with `yarn example android` or `yarn example ios` from monorepo root

### Testing Requirements
- Build and run on device/simulator to verify native module integration
- Both "Run File Tests" and "Test Download" buttons should complete without errors

### Common Patterns
- useCallback for test functions
- useLogger hook for log display
- TextEncoder/TextDecoder for string ↔ ArrayBuffer conversion
- Chunk merging pattern for streaming reads

## Dependencies

### Internal
- `react-native-buffered-blob` (workspace) — Turbo Module library
- `react-native-nitro-buffered-blob` (workspace) — Nitro Module library

### External
- `react` 19.2.0
- `react-native` 0.83.0
- `react-native-nitro-modules` ^0.33.9

<!-- MANUAL: -->
