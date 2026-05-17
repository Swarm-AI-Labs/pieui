#!/usr/bin/env bash
# PostToolUse hook: nudge Claude to verify CLI symmetry with the linked backend (pie).
# Fires when Edit/Write/MultiEdit touches pieui CLI/handler files.
#
# Contract:
#   - Reads tool input JSON from stdin (Claude Code PostToolUse payload).
#   - Writes a one-shot reminder to stdout when a CLI-relevant file changed.
#   - Always exits 0 so the hook never blocks the underlying tool call.

set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

extract_path() {
    python3 - "$INPUT" <<'PY' 2>/dev/null
import json, sys
try:
    payload = json.loads(sys.argv[1] or "{}")
except Exception:
    sys.exit(0)
ti = payload.get("tool_input") or {}
# Edit / Write
p = ti.get("file_path")
if isinstance(p, str):
    print(p); sys.exit(0)
# MultiEdit / NotebookEdit
edits = ti.get("edits")
if isinstance(edits, list) and edits and isinstance(edits[0], dict):
    p = edits[0].get("file_path")
    if isinstance(p, str):
        print(p); sys.exit(0)
PY
}

FILE_PATH="$(extract_path)"
[ -z "${FILE_PATH:-}" ] && exit 0

case "$FILE_PATH" in
    */src/cli.ts|*/src/code/args.ts|*/src/code/types.ts|*/src/code/commands/*|*/src/code/commands/cardRemote/*)
        cat <<'NUDGE'

[cli-symmetry] pieui CLI/handler file changed. Verify symmetry with backend `pie` (reference at ../pie).
  - The pie CLI is the SOURCE OF TRUTH for command structure (subcommand names, args, flags).
  - If you added/renamed/removed a pieui command, mirror it in pie (../pie/pie/__main__.py + ../pie/pie/code/).
  - If you changed only an implementation detail (no surface change), no action needed.
  - Quick check: compare top-level commands with
        diff <(node ./dist/cli.js --help 2>/dev/null | grep -E '^  [a-z]') \
             <(cd ../pie && /Users/kaspar_george/pie/.venv/bin/python -m pie --help 2>/dev/null | grep -E '^    [a-z]')
NUDGE
        ;;
esac

exit 0