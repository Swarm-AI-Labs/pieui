# CLI Autotest Instructions

## Prerequisites
- Bun installed (`1.3.x` recommended)
- Dependencies installed in repo root

## Run Phase 1 CLI Tests
From repository root:

```bash
~/.bun/bin/bun test src/__tests__/cli-phase1.test.cjs src/__tests__/cli-postbuild.test.cjs
```

Alternative (if `bun` is in PATH):

```bash
bun test src/__tests__/cli-phase1.test.cjs src/__tests__/cli-postbuild.test.cjs
```

## Run All Tests

```bash
~/.bun/bin/bun test
```

## What Phase 1 Verifies
- Local scaffold and config flows (`init`, `add`, `remove`)
- Local analysis/edit flows (`list`, `list-events`, `add-event`)
- Local manifest generation (`postbuild`)

## Troubleshooting
- If you see `command not found: bun`:
  - use the full binary path `~/.bun/bin/bun`
  - or start a new shell session so PATH updates apply
- If tests fail unexpectedly, re-run with file-level command first:

```bash
~/.bun/bin/bun test src/__tests__/cli-phase1.test.cjs
```
