<!-- Generated: 2026-02-15 | Updated: 2026-02-16 -->

# react-native-nitro-blob

## Purpose
A React Native library for OOM-safe file I/O and downloads using buffered streaming. Organized as a Yarn workspaces monorepo with two library packages and two example apps.

## Architecture
The library solves OOM issues found in `react-native-blob-util` by using chunked streaming instead of loading entire files into memory. It provides two packages:

- **react-native-nitro-buffered-blob** — Nitro Module implementation with zero-copy ArrayBuffer via HybridObjects (Swift/Kotlin native)
- **react-native-buffered-blob** — Standalone Turbo Module + JSI HostObject implementation (no Nitro dependency, C++/ObjC++/Kotlin)

Both packages expose streaming readers/writers that operate on chunks, file system operations (exists, stat, unlink, mkdir, ls, cp, mv), hashing (SHA256, MD5), and downloads with progress.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo root with workspaces config, scripts, devDependencies |
| `eslint.config.mjs` | Flat ESLint config (ESLint 9) with `@react-native` + prettier |
| `lefthook.yml` | Pre-commit hooks: lint + typecheck; commit-msg: commitlint |
| `turbo.json` | Turborepo config for build orchestration |
| `tsconfig.json` | Root TypeScript config (referenced by packages) |
| `babel.config.js` | Root Babel config |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `packages/react-native-nitro-buffered-blob/` | Nitro Module package (see `packages/react-native-nitro-buffered-blob/AGENTS.md`) |
| `packages/react-native-buffered-blob/` | Turbo Module + JSI package (see `packages/react-native-buffered-blob/AGENTS.md`) |
| `examples/buffered-blob-example/` | Example app testing the Turbo Module wrapper API |
| `examples/nitro-buffered-blob-example/` | Example app testing the Nitro Module API directly |
| `.github/` | CI workflows and issue templates |
| `.yarn/` | Yarn Berry releases (PnP) |

## For AI Agents

### Working In This Directory
- This is a Yarn 4 (Berry) monorepo with PnP — use `yarn install`, not `npm install`
- Pre-commit hooks run `npx tsc` and `npx eslint` — both must pass before committing
- Use `yarn native` to run commands in the nitro package, `yarn wrapper` for the turbo module package
- Use `yarn example:blob` for the buffered-blob example, `yarn example:nitro` for the nitro example
- Generated files in `packages/*/lib/` and `nitrogen/generated/` should NOT be manually edited
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `ci:`, etc.)

### Testing Requirements
- Run `yarn typecheck` from root to typecheck both packages
- Run `yarn lint` for ESLint linting
- Run `yarn test` for Jest unit tests
- Build example apps: `yarn example:blob android` / `yarn example:nitro ios`

### Common Patterns
- Prettier with single quotes, 2-space indent, trailing commas (es5)
- Strict TypeScript with `noUnusedLocals`, `noUnusedParameters`
- ESM modules via react-native-builder-bob

## Dependencies

### External
- `react-native` 0.83.0 (New Architecture)
- `react-native-nitro-modules` ^0.33.9 (for nitro package)
- `react-native-builder-bob` for library builds
- `lefthook` for git hooks
- `turbo` for monorepo build orchestration
- `release-it` with conventional changelog for releases

<!-- MANUAL: -->
