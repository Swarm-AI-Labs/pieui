# CLI Autotest Instructions

## Brief

- Step 1 (`step1-local`) covers local CLI regression behavior:
    - `init`, `add`, `remove`, `list`, `list-events`, `add-event`, `postbuild`
    - includes edge cases (idempotency, invalid args, built-in methods scanning, schema overrides)
- Step 2 (`step2-remote`) covers remote CLI regression behavior:
    - `push`, `pull`, `remote-remove`
    - includes request/response contracts, slug/header/query checks, header-presence/absence checks, error propagation, and archive safety
- Step 3 (`step3-contract`) covers CLI contract regression behavior:
    - usage output, exit codes, required-argument errors, and flag/default contracts
    - includes wording checks for stable user-facing CLI output and parser edge-case contracts
- Step 4 (`step4-ci`) covers CI hardening contracts:
    - package test script entrypoints
    - CI workflow gate steps/log artifact upload/cleanup hooks
    - built artifact export contracts (dist bundles, required symbols, types, and component registration markers)
    - local cleanup utility behavior (`dry-run` and real removal)
- Step 5 (`step5-regres`) covers targeted bug-regression contracts:
    - `add` rollback/clean failure when `registry.ts` is missing
    - `pull` rollback safety when archive extraction fails
    - top-level async error formatting for `push`, `pull`, `remote-remove`

## Prerequisites

- Bun installed (`1.3.x` recommended)
- Dependencies installed in repo root

## Run Phase 1 CLI Tests

Phase 1 scenarios are now unified in one test file (`step1-local.test.cjs`).

From repository root:

```bash
~/.bun/bin/bun test src/__tests__/step1-local.test.cjs
```

Alternative (if `bun` is in PATH):

```bash
bun test src/__tests__/step1-local.test.cjs
```

## Run All Tests

```bash
~/.bun/bin/bun test
```

## Run Full Step Suite

```bash
~/.bun/bin/bun test src/__tests__/step1-local.test.cjs src/__tests__/step2-remote.test.cjs src/__tests__/step3-contract.test.cjs src/__tests__/step4-ci.test.cjs src/__tests__/step5-regres.test.cjs
```

## Step-Named Suites

- `src/__tests__/step1-local.test.cjs` - implemented local regression tests
- `src/__tests__/step2-remote.test.cjs` - implemented remote regression tests
- `src/__tests__/step3-contract.test.cjs` - implemented contract regression tests
- `src/__tests__/step4-ci.test.cjs` - implemented CI hardening tests
- `src/__tests__/step5-regres.test.cjs` - implemented bug-regression tests

## Run Step 2 Remote Tests

From repository root:

```bash
~/.bun/bin/bun test src/__tests__/step2-remote.test.cjs
```

## Run Step 3 Contract Tests

From repository root:

```bash
~/.bun/bin/bun test src/__tests__/step3-contract.test.cjs
```

## Run Step 4 CI-Hardening Tests

From repository root:

```bash
~/.bun/bin/bun test src/__tests__/step4-ci.test.cjs
```

## Run Step 5 Bug-Regression Tests

From repository root:

```bash
~/.bun/bin/bun test src/__tests__/step5-regres.test.cjs
```

## What Phase 1 Verifies

- Local scaffold and config flows (`init`, `add`, `remove`)
- Local analysis/edit flows (`list`, `list-events`, `add-event`)
- Local manifest generation (`postbuild`)
- Idempotency/defaults/error paths for regression protection

## Troubleshooting

- If you see `command not found: bun`:
    - use the full binary path `~/.bun/bin/bun`
    - or start a new shell session so PATH updates apply
- If tests fail unexpectedly, re-run with file-level command first:

```bash
~/.bun/bin/bun test src/__tests__/step1-local.test.cjs
```

## Manual Example (Remote Flow)

Manual `remote-remove` contract check against a local mock server:

```bash
cd /Users/valentinkuzmenkov/Documents/Playground/pieui

TMP_DIR="$(mktemp -d /tmp/pieui-manual-remote-XXXX)"
cat > "$TMP_DIR/package.json" <<'EOF'
{"name":"@org/demo-app"}
EOF

node -e '
const http = require("http");
const s = http.createServer((req,res)=>{console.log(req.method, req.url, req.headers["x-api-key"]); res.end("ok");});
s.listen(0,"127.0.0.1",()=>console.log(s.address().port));
' > "$TMP_DIR/port.txt" &
SERVER_PID=$!
sleep 1
PORT="$(tail -n 1 "$TMP_DIR/port.txt")"

(
  cd "$TMP_DIR" || exit 1
  PIEUI_EXTERNAL_REMOVE_URL="http://127.0.0.1:$PORT/remove" \
  PIEUI_EXTERNAL_API_KEY="manual-key" \
  ~/.bun/bin/bun /Users/valentinkuzmenkov/Documents/Playground/pieui/src/cli.ts remote-remove LegacyCard
)

kill "$SERVER_PID"
```

Expected:

- CLI exits successfully.
- Server log prints `DELETE /remove?component=demo-app%2FLegacyCard manual-key`.

## Manual Example (Step 3 Contract)

Manual usage/exit-code contract check:

```bash
cd /Users/valentinkuzmenkov/Documents/Playground/pieui

~/.bun/bin/bun src/cli.ts unknown-cmd
echo "exit_code=$?"
```

Expected:

- Output includes `Usage: pieui <command> [options]`
- `exit_code=1`

## Manual Example (Step 4 Cleanup Utility)

Preview cleanup targets without deleting:

```bash
cd /Users/valentinkuzmenkov/Documents/Playground/pieui
node scripts/cleanup-test-artifacts.mjs --dry-run --prefix=pieui-
```

Then perform cleanup:

```bash
node scripts/cleanup-test-artifacts.mjs --prefix=pieui-
```
