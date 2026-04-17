# CLI Autotest Report (Phase 1)

Date: 2026-04-17
Branch: `cli-autotest`
Scope: local CLI commands only (no real network calls)

## Goal
Implement initial automated tests for PieUI CLI local workflows and validate they run reliably in isolation.

## Implemented
- Added unified Phase 1 integration test suite:
  - `src/__tests__/step1-local.test.cjs`
- Added roadmap placeholder suites:
  - `src/__tests__/step2-remote.test.cjs`
  - `src/__tests__/step3-contract.test.cjs`
  - `src/__tests__/step4-ci.test.cjs`
- Consolidated previous split local scenarios into `step1-local.test.cjs`.

## Covered Commands
- `init`
  - creates `piecomponents/registry.ts`
  - updates `tailwind.config.js` with PieUI content path
  - updates existing `next.config.ts` with PieUI env/transpile settings
- `add`
  - creates component scaffold (`index.ts`, `types/index.ts`, `ui/<Component>.tsx`)
  - registers component import in `registry.ts`
- `remove`
  - deletes component directory
  - removes registry import
- `list`
  - lists created components
  - supports filter argument and reports filtered mode
- `list-events`
  - extracts methods keys for matching `<PieCard card="..." methods={{...}} />`
- `add-event`
  - inserts new inline methods handler
  - validates invalid event key failure path
- `postbuild`
  - writes empty manifest when no components found

## Scenario Inventory
- `init` baseline behavior with Tailwind/Next config updates
- `init` idempotency and `--out-dir` support
- `add` + `remove` happy path
- `add` default type behavior (implicit `complex-container`)
- `add` invalid component name failure
- `add` duplicate component failure
- `remove` missing component warning behavior
- `list` general output and filter behavior
- `list` invalid filter fallback to `all`
- `list-events` extraction for matching component
- `list-events` extraction from `useMemo`-backed methods variable
- `list-events` mixed method syntax support (property/shorthand/method declaration)
- `list-events` built-in component method coverage (repository source)
- `list-events` no-match behavior
- `add-event` inline insertion success
- `add-event` insertion into empty methods object
- `add-event` invalid event key failure
- `add-event` failure for non-inline methods objects
- `postbuild` empty-manifest behavior
- `postbuild` discovered component schema generation

## Test Execution
Command used:

```bash
~/.bun/bin/bun test src/__tests__/step1-local.test.cjs
```

Result:
- 20 passed
- 0 failed

## Notes / Observations
- Runtime resolution now supports Bun from both:
  - `bun` in PATH
  - `~/.bun/bin/bun`
- `list` type inference can classify template-generated components in ways that are broader than expected; current assertions focus on command behavior and filter reporting.

## Out of Scope (for next phase)
- Remote commands with mocked transport:
  - `push`, `pull`, `remote-remove`
- Full argument/error matrix for all invalid combinations
- Additional edge-cases around `add-event` formatting variants and non-inline methods objects
