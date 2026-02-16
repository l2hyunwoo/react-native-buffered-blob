<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-16 | Updated: 2026-02-16 -->

# nitro-buffered-blob-example

## Purpose

React Native example app for testing the `react-native-nitro-buffered-blob` (Nitro Module) package. Provides interactive UI tests and `react-native-harness` integration tests. Tests the Nitro HybridObject API directly via `NitroModules.createHybridObject()`.

## Key Files

| File | Description |
|------|-------------|
| `src/App.tsx` | Main app: creates `BufferedBlobModule` HybridObject, tests FS ops, read/write, copy/move, download |
| `package.json` | App config with workspace dep on `react-native-nitro-buffered-blob` + `react-native-nitro-modules` |
| `metro.config.js` | Metro bundler config for monorepo |
| `babel.config.js` | Babel config |
| `jest.harness.config.mjs` | Jest config for react-native-harness tests |
| `rn-harness.config.mjs` | react-native-harness runner configuration |
| `tsconfig.json` | TypeScript config for the example app |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | App source code and harness tests |
| `android/` | Android project (Gradle, MainActivity, MainApplication) |
| `ios/` | iOS project (Xcode, Podfile, AppDelegate) |

## For AI Agents

### Working In This Directory

1. **Build**: `yarn example:nitro android` or `yarn example:nitro ios` from monorepo root
2. **Run**: `yarn example:nitro start` for Metro, then run from Xcode/Android Studio
3. **Harness tests**: Located in `src/__tests__/*.harness.ts`. Run with `yarn test:harness`
4. **Direct API**: This app uses `NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule')` to get the module instance directly — no wrapper layer
5. **Workspace link**: Uses `"react-native-nitro-buffered-blob": "workspace:*"`
6. **Nitrogen codegen**: Run `yarn nitrogen` from the library package before building if specs changed

### Harness Test Files

| File | Tests |
|------|-------|
| `download.harness.ts` | Download with progress, cancellation |
| `error.harness.ts` | Error handling |
| `fileOps.harness.ts` | exists, stat, mkdir, ls, cp, mv, unlink |
| `fileReader.harness.ts` | NativeFileReader streaming reads |
| `fileWriter.harness.ts` | NativeFileWriter streaming writes |
| `hash.harness.ts` | SHA256, MD5 file hashing |
| `module.harness.ts` | Module creation, directory path properties |

### Testing Requirements

- All harness tests must pass on both iOS and Android
- Manual testing via "Run All Tests" button
- Verify zero-copy ArrayBuffer transfer works correctly
- Test with large files to confirm no OOM

## Dependencies

### Internal
- `react-native-nitro-buffered-blob` (workspace) — The library under test
- `react-native-nitro-modules` — Nitro runtime for HybridObject creation

### External
- React Native 0.83.0
- `react-native-harness` — On-device integration test framework
- `react-native-monorepo-config` — Monorepo configuration

<!-- MANUAL: -->
