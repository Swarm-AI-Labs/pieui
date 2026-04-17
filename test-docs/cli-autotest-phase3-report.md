# CLI Autotest Report (Phase 3)

Date: 2026-04-17
Branch: `cli-autotest`
Scope: CLI contract regression tests (usage text, exit codes, flag behavior, and stable output wording)

## Goal
Protect user-facing CLI contracts from accidental breakage when implementation changes.

## Implemented
- Added full Step 3 contract regression suite:
  - `src/__tests__/step3-contract.test.cjs`

## Covered Contract Areas
- Usage and command routing
  - empty command => usage + exit code `1`
  - unknown command => usage + exit code `1`
- Required-argument validation
  - `add`, `remove`, `list-events`, `add-event`
  - error message + usage presence contracts
- Flag/default behavior contracts
  - `postbuild` default log values (`srcDir`, `outDir`, `append`)
  - `postbuild` equals-form flags + append
  - `postbuild` short-form flags (`-s`, `-o`)
  - `list -s` source-dir contract
  - `list --src-dir=<dir>` equals-form contract
  - `init -o` output-dir contract
  - `init --out-dir=<dir>` equals-form contract
- Stable output wording
  - invalid `list` filter fallback avoids filtered suffix
  - `add` output type line for default and explicit type
  - usage output includes key command entries
- Validation/error wording
  - `remove` when root missing
  - `add-event` invalid key
  - `add` unknown type token fallback behavior

## Test Execution
Command used:

```bash
~/.bun/bin/bun test src/__tests__/step3-contract.test.cjs
```

Result:
- 17 passed
- 0 failed

## Notes
- These tests intentionally assert user-visible text fragments and exit codes to guard CLI compatibility.
