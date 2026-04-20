# CLI Autotest Phase 5 Report (step5-regres)

## Goal

Add regression tests that lock down three discovered CLI bugs and prevent future reintroductions.

## Implemented

- Added `src/__tests__/step5-regres.test.cjs`.
- Added package script `test:step5`.
- Extended `test:steps` to include step 5.
- Extended CI workflow to run and log step 5.
- Updated CI contract tests in `step4-ci.test.cjs` to validate step 5 wiring.

## Step 5 Cases

1. `add` regression:

- Missing `piecomponents/registry.ts` fails with stable error.
- No partial component directory is left behind.

2. `pull` regression:

- Unsafe zip entry (path traversal) fails pull.
- Existing local component remains intact after failure.

3. CLI async error-format regression:

- `push`, `pull`, and `remote-remove` non-2xx responses are surfaced as stable top-level `[pieui] Error: ...` messages.
- Stack-trace noise is not printed to stderr.

## How To Run

- Step 5 only:

```bash
~/.bun/bin/bun test src/__tests__/step5-regres.test.cjs
```

- Full step suite:

```bash
~/.bun/bin/bun test src/__tests__/step1-local.test.cjs src/__tests__/step2-remote.test.cjs src/__tests__/step3-contract.test.cjs src/__tests__/step4-ci.test.cjs src/__tests__/step5-regres.test.cjs
```
