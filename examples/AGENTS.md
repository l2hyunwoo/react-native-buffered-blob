<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-16 | Updated: 2026-02-16 -->

# examples

## Purpose

Container directory for React Native example apps that demonstrate and test both library packages. Each example app targets one package and provides interactive UI tests and automated harness tests.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `buffered-blob-example/` | Example app for react-native-buffered-blob (Turbo Module wrapper API) (see `buffered-blob-example/AGENTS.md`) |
| `nitro-buffered-blob-example/` | Example app for react-native-nitro-buffered-blob (Nitro Module direct API) (see `nitro-buffered-blob-example/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- Both apps are React Native 0.83.0 projects with New Architecture enabled
- Build from monorepo root: `yarn example:blob android|ios` or `yarn example:nitro android|ios`
- Both apps use `react-native-harness` for automated on-device integration tests
- Run harness tests: `yarn test:harness` (iOS) or `yarn test:harness:android`
- Changes to library packages are picked up automatically via workspace linking

<!-- MANUAL: -->
