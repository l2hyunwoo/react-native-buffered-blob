<!-- Generated: 2026-02-15 | Updated: 2026-02-15 -->

# react-native-nitro-blob

## Purpose
A React Native library for OOM-safe file I/O and downloads using buffered streaming. Organized as a Yarn workspaces monorepo with two library packages and one example app.

## Architecture
The library solves OOM issues found in `react-native-blob-util` by using chunked streaming instead of loading entire files into memory. It provides two packages:

- **react-native-nitro-buffered-blob** — Nitro Module implementation with zero-copy ArrayBuffer via HybridObjects
- **react-native-buffered-blob** — Standalone Turbo Module + JSI HostObject implementation (no Nitro dependency)

Both packages expose streaming readers/writers that operate on chunks, avoiding the byte-array-in-memory pattern that causes OOM.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo root with workspaces config, scripts, devDependencies |
| `eslint.config.mjs` | Flat ESLint config (ESLint 9) with `@react-native` + prettier |
| `lefthook.yml` | Pre-commit hooks: lint + typecheck; commit-msg: commitlint |
| `turbo.json` | Turborepo config for build orchestration |
| `tsconfig.json` | Root TypeScript config (referenced by nitro package) |
| `babel.config.js` | Root Babel config |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `packages/react-native-nitro-buffered-blob/` | Nitro Module package (see `packages/react-native-nitro-buffered-blob/AGENTS.md`) |
| `packages/react-native-buffered-blob/` | Turbo Module package (see `packages/react-native-buffered-blob/AGENTS.md`) |
| `example/` | React Native example app (see `example/AGENTS.md`) |
| `.github/` | CI workflows and issue templates |

## For AI Agents

### Working In This Directory
- This is a Yarn 4 (Berry) monorepo with PnP — use `yarn install`, not `npm install`
- Pre-commit hooks run `npx tsc` and `npx eslint` — both must pass before committing
- Use `yarn native` to run commands in the nitro package, `yarn wrapper` for the turbo module package
- Generated files in `packages/*/lib/` and `nitrogen/generated/` should NOT be manually edited

### Testing Requirements
- Run `npx tsc` from root to typecheck
- Run `npx eslint "**/*.{js,ts,tsx}"` for linting
- Build example app with `yarn example android` or `yarn example ios`

### Common Patterns
- Prettier with single quotes, 2-space indent, trailing commas (es5)
- Strict TypeScript with `noUnusedLocals`, `noUnusedParameters`
- ESM modules with `verbatimModuleSyntax`

## Dependencies

### External
- `react-native` >=0.76.0 (New Architecture only)
- `react-native-nitro-modules` ^0.33.9 (for nitro package)
- `react-native-builder-bob` for library builds
- `lefthook` for git hooks
- `turbo` for monorepo build orchestration

<!-- MANUAL: -->
