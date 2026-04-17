# CLI Autotest Report (Phase 2)

Date: 2026-04-17
Branch: `cli-autotest`
Scope: remote CLI command regression tests with local mocked HTTP server

## Goal

Protect network-related CLI behavior (`push`, `pull`, `remote-remove`) from regressions without relying on external APIs.

## Implemented

- Added full Step 2 remote regression suite:
    - `src/__tests__/step2-remote.test.cjs`
- Added endpoint override support for deterministic tests:
    - `src/code/commands/push.ts` (`PIEUI_EXTERNAL_PUSH_URL`)
    - `src/code/commands/pull.ts` (`PIEUI_EXTERNAL_PULL_URL`)
    - `src/code/commands/remoteRemove.ts` (`PIEUI_EXTERNAL_REMOVE_URL`)

## Covered Commands

- `push`
    - multipart upload contract (`component` + `file`)
    - zip payload integrity checks
    - API key header forwarding and header-absence behavior
    - project slug derivation from `package.json` and cwd fallback
    - upstream error propagation
    - missing local directory/component failures
- `pull`
    - URL/query construction and API key forwarding/header-absence behavior
    - archive extraction and overwrite behavior
    - windows-style path normalization (`\` separators)
    - path traversal protection (`unsafe path in archive`)
    - upstream error propagation
    - missing local directory failure
- `remote-remove`
    - method/query/header contract and header-absence behavior
    - project slug fallback from cwd when `package.json` is absent
    - upstream error propagation
- CLI arg validation
    - required component name checks for all remote commands

## Test Execution

Command used:

```bash
~/.bun/bin/bun test src/__tests__/step2-remote.test.cjs
```

Result:

- 17 passed
- 0 failed

## Notes

- Tests use a local HTTP server per scenario (no external network dependency).
- Endpoint env overrides are additive and default behavior still points to production URLs when overrides are not set.
