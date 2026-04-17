# CLI Autotest Report (Phase 1)

Date: 2026-04-17
Branch: `cli-autotest`
Scope: local CLI commands only (no real network calls)

## Goal
Implement initial automated tests for PieUI CLI local workflows and validate they run reliably in isolation.

## Implemented
- Added new integration test suite:
  - `src/__tests__/cli-phase1.test.cjs`
- Updated existing CLI test runtime resolution:
  - `src/__tests__/cli-postbuild.test.cjs`

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

## Test Execution
Command used:

```bash
~/.bun/bin/bun test src/__tests__/cli-phase1.test.cjs src/__tests__/cli-postbuild.test.cjs
```

Result:
- 7 passed
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
