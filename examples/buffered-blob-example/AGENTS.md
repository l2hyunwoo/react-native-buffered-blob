<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-16 | Updated: 2026-02-16 -->

# buffered-blob-example

## Purpose

React Native example app for testing the `react-native-buffered-blob` (Turbo Module) package. Provides interactive UI buttons for manual testing and `react-native-harness` integration tests for automated on-device validation.

## Key Files

| File | Description |
|------|-------------|
| `src/App.tsx` | Main app: interactive test buttons for FS ops, read/write, copy/move, download with log output |
| `package.json` | App config with build scripts, workspace dependency on `react-native-buffered-blob` |
| `metro.config.js` | Metro bundler config for monorepo |
| `babel.config.js` | Babel config with `@react-native/babel-preset` |
| `jest.harness.config.mjs` | Jest config for react-native-harness integration tests |
| `rn-harness.config.mjs` | react-native-harness runner configuration |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | App source code and harness tests |
| `android/` | Android project (Gradle, MainActivity, MainApplication) |
| `ios/` | iOS project (Xcode, Podfile, AppDelegate) |

## For AI Agents

### Working In This Directory

1. **Build**: `yarn example:blob android` or `yarn example:blob ios` from monorepo root
2. **Run**: `yarn example:blob start` for Metro, then run from Xcode/Android Studio
3. **Harness tests**: Located in `src/__tests__/*.harness.ts`. Run with `yarn test:harness` (iOS) or `yarn test:harness:android`
4. **Wrapper API**: This app tests the high-level wrapper API (`createReader`, `createWriter`, `download`, `exists`, `stat`, etc.) exported from `react-native-buffered-blob`
5. **Workspace link**: Uses `"react-native-buffered-blob": "workspace:*"` — changes to the library are reflected immediately

### Harness Test Files

| File | Tests |
|------|-------|
| `download.harness.ts` | Download with progress, cancellation |
| `error.harness.ts` | Error code parsing, BlobError handling |
| `fileOps.harness.ts` | exists, stat, mkdir, ls, cp, mv, unlink |
| `hash.harness.ts` | SHA256, MD5 file hashing |
| `paths.harness.ts` | Dirs constants, path utilities |
| `streaming.harness.ts` | createReader/createWriter streaming operations |

### Testing Requirements

- All harness tests must pass on both iOS and Android before releases
- Manual testing via App.tsx "Run All Tests" button for interactive verification
- Verify no memory leaks when streaming large files

## Dependencies

### Internal
- `react-native-buffered-blob` (workspace) — The library under test

### External
- React Native 0.83.0
- `react-native-harness` — On-device integration test framework
- `react-native-monorepo-config` — Monorepo Metro/Babel configuration

<!-- MANUAL: -->
