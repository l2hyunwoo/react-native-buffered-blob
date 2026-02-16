<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-16 | Updated: 2026-02-16 -->

# .github

## Purpose

GitHub Actions CI configuration, reusable composite actions, and issue templates for the react-native-nitro-blob monorepo.

## Key Files

| File | Description |
|------|-------------|
| `workflows/ci.yml` | Main CI workflow: lint, test, build-library, build-android, build-ios |
| `actions/setup/action.yml` | Composite action: Node.js setup (from `.nvmrc`), yarn dependency caching and install |
| `ISSUE_TEMPLATE/bug_report.yml` | Bug report template |
| `ISSUE_TEMPLATE/config.yml` | Issue template chooser config |

## For AI Agents

### Working In This Directory

1. **CI workflow triggers**: Runs on push to `main`, PRs to `main`, and merge queue checks
2. **Concurrency**: Uses `github.workflow`-`github.ref` group with `cancel-in-progress: true`
3. **Turborepo caching**: Android and iOS builds use turborepo cache to skip rebuilds. Check turbo cache status before running expensive steps.
4. **Setup action**: Composite action at `.github/actions/setup/` handles Node.js and yarn install with caching. Used by all CI jobs.
5. **Platform builds**: Android needs JDK 17 (Zulu), NDK 27.1.12297006. iOS needs Xcode 26, CocoaPods.
6. **Nitrogen codegen**: `yarn nitrogen` runs before Android and iOS builds to generate native specs.
7. **Pinned actions**: All GitHub Actions use pinned commit SHAs for security.

### CI Jobs

| Job | Runner | What It Does |
|-----|--------|--------------|
| `lint` | ubuntu-latest | `yarn lint` + `yarn typecheck` |
| `test` | ubuntu-latest | `yarn test --maxWorkers=2 --coverage` |
| `build-library` | ubuntu-latest | `yarn prepare` (TypeScript build) |
| `build-android` | ubuntu-latest | Nitrogen codegen + Gradle build of example apps |
| `build-ios` | macos-latest | Nitrogen codegen + CocoaPods install + Xcode build of example apps |

### Modifying CI

- Add new jobs to `ci.yml` following existing patterns
- Use the `Setup` composite action for dependency installation
- Pin new GitHub Actions to commit SHAs
- Test CI changes on a PR before merging to `main`

## Dependencies

### External
- `actions/checkout@v5` — Repository checkout
- `actions/setup-node@v4` — Node.js setup
- `actions/cache@v4` — Dependency and build caching
- `actions/setup-java@v4` — JDK for Android builds
- `maxim-lobanov/setup-xcode@v1` — Xcode version selection

<!-- MANUAL: -->
