# CLI Autotest Report (Phase 4)

Date: 2026-04-17
Branch: `cli-autotest`
Scope: CI hardening and test orchestration contracts

## Goal

Ensure automated step suites are consistently runnable in CI and locally, with deterministic gates, logs, and cleanup behavior.

## Implemented

- Added step-focused npm scripts in `package.json`:
    - `test:step1`, `test:step2`, `test:step3`, `test:step4`
    - `test:steps` (all step suites)
    - `test:cleanup` (temporary test artifact cleanup)
- Added cleanup utility:
    - `scripts/cleanup-test-artifacts.mjs`
    - supports `--dry-run` and `--prefix=<value>`
- Updated CI workflow:
    - `.github/workflows/ci.yml`
    - runs step suites with per-step logs
    - runs step4 after `build` as the build/export verification gate
    - fails pipeline if any step fails
    - always runs cleanup
    - always uploads step logs as artifact (`step-suite-logs`)
- Added Step 4 test suite:
    - `src/__tests__/step4-ci.test.cjs`
- Removed old standalone export verification script:
    - `scripts/verify-exports.mjs` (logic migrated into `step4-ci` tests)

## Step 4 Coverage

- Package script contract checks
- CI workflow gate/log/cleanup/artifact contract checks
- Build/export contract checks:
    - required `dist` files and declaration files
    - required runtime and components export names
    - required built-in registration markers in built bundle
- Cleanup utility behavior:
    - dry-run keeps directories
    - non-dry-run removes only matching prefix directories

## Test Execution

Command used:

```bash
~/.bun/bin/bun test src/__tests__/step4-ci.test.cjs
```

Result:

- 5 passed
- 0 failed

## Notes

- Step 4 includes full build artifact contract verification and CI contract checks.
- CI now has explicit observability via per-step logs in uploaded artifacts.
