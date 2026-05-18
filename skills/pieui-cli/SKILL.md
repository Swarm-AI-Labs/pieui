---
name: pieui-cli
description: Use this skill whenever working with a PieUI project — creating components, pages, and AJAX handlers, porting cards from a Python backend, publishing to remote storage, checking frontend/backend contract sync, or dumping component metadata. Triggers on any mention of "pieui", "PieCard", "piecomponents", "pie card", "pie page", or requests to scaffold/port/publish/sync a card. Use even if the user just asks how to add a component or page in a pieui project.
---

# pieui CLI Skill

PieUI uses a CLI-driven workflow. The CLI enforces structural conventions — files it generates cannot be replicated correctly by hand. **Never create component directories, page files, or event handlers manually.** The only exception is business logic inside method bodies and render functions.

## Strict rules

- **New component** → `pieui card add [type] <Name>` only. Never `mkdir piecomponents/Foo && touch index.ts`.
- **New page** → `pieui page add <path>` only. Never `touch app/dashboard/page.tsx`.
- **New AJAX handler on a page** → `pieui page ajax <path> add <handler>` only. Never edit the handler block directly.
- **New event/method on a card** → `pieui card add-event <Name> <event>` only.
- Direct edits are allowed only inside generated method bodies and the component's render function.

---

## Commands

### Project setup

**`pieui create <AppName>`**
Creates a Next.js app, runs `pieui init` inside it, installs `@swarm.ing/pieui`, wires Storybook.
```
pieui create my-app
```
Env overrides: `PIEUI_CREATE_PACKAGE_SPEC` (default `@swarm.ing/pieui`), `PIEUI_CREATE_NEXT_APP_SPEC` (default `next-app@latest`), `PIEUI_CREATE_BUN_BIN` (default `bun`), `PIEUI_CREATE_SKIP_STORYBOOK=1`.

**`pieui create-pie-app <AppName>`** / **`create-pieui <AppName>`**
Blank Next.js template without the full `init` flow. Use for minimal setups.

**`pieui init [--out-dir <dir>]`**
Initialises `piecomponents/`, `registry.ts`, Tailwind, and `next.config`. Prompts for backend dirs. Safe to re-run.

**`pieui login`**
Signs in and saves credentials to `.pie/config.json`. Required before any `card remote` command.

**`pieui self-upgrade [--pm bun|npm|pnpm|yarn]`**
Upgrades the globally installed CLI to the latest published version. Auto-detects package manager (prefers bun → pnpm → yarn → npm).
```
pieui self-upgrade
pieui self-upgrade --pm npm
```

**`pieui postbuild [--out-dir <dir>] [--src-dir <dir>] [--append]`**
Scans source for `registerPieComponent` calls and writes a component manifest. Add to CI after `tsc`. `--append` includes built-in pieui components.

---

### Card management

**`pieui card add [type] <Name> [--io] [--ajax] [--from <ref>]`**

Types: `simple` · `complex` · `simple-container` · `complex-container` (default).

| Flag | Effect |
|------|--------|
| `--io` | Adds realtime fields (`use_*_support`) to the data interface |
| `--ajax` | Adds AJAX request fields (`pathname`, `deps_names`, `kwargs`) |
| `--from <ref>` | Port from Python backend (see below) |

```
pieui card add MyCard                       # complex-container, no extras
pieui card add simple LabelCard
pieui card add simple LiveCard --io --ajax
pieui card add MyCard --from ../pie/components/my_card.py
pieui card add MyCard --from dump.json      # from a dump-metadata JSON
pieui card add MyCard --from MyCard         # resolves via backendComponentsDir in .pie/config.json
```

`--from` resolution order:
1. Existing `.json` file → reads `{typescript: {...}}` envelope directly.
2. Existing `.py` file → invokes `pie card dump-metadata <Name>` via subprocess.
3. Existing directory → uses `backendComponentsDir` root from `.pie/config.json`.
4. Name string → resolves to `<backendComponentsDir>/<snake_case_name>_card.py`.

Auto-`--from`: if `backendComponentsDir` is configured and a matching `.py` exists, `card add <Name>` uses it without an explicit flag.

---

**`pieui card list [filter]`**
Lists components in a table. Filters: `all` · `simple` · `complex` · `simple-container` · `complex-container`.

**`pieui card pull <ref>`**
Pulls a card from multiple sources without needing to specify type:
- `MyCard` or `project/MyCard` → downloads from PieUI storage (same as `card remote pull`).
- `r/user/MyCard` → downloads a public card by the given user.
- `./dump.json` or `/abs/path/dump.json` → reconstructs from a local dump-metadata JSON.
- `https://...` → fetches a dump-metadata JSON from a URL and reconstructs.

```
pieui card pull r/alice/HeroCard
pieui card pull ./exports/HeroCard.json
pieui card pull https://storage.example.com/HeroCard.json
```

**`pieui card view <Name>`**
Prints name, data props, ajax fields, IO fields, and registered events. Quick sanity check before editing.

**`pieui card remove <Name>`**
Removes `piecomponents/<Name>/` and deregisters from `registry.ts`.

**`pieui card list-events <Name>`**
Lists all method keys registered in `<PieCard methods={...} />` usage for this card.

**`pieui card add-event <Name> <event>`**
Appends a new handler key with a default stub to `<PieCard methods={{...}}>`.
```
pieui card add-event MoodCard like
pieui card add-event MoodCard save
```

**`pieui card add-story <Name>`**
Generates a Storybook `stories.tsx` wired to `PieCard` methods. Run after events are defined.

**`pieui card dump-metadata <Name> [--out file.json]`**
Emits full `PieMetadata` JSON wrapped in `{"typescript": {...}}`. Writes to stdout or `--out` file.

When `--out` targets an existing file, merges under the `typescript` key without touching sibling keys (e.g., a `python` key written by `pie card dump-metadata --out <same-file>`).
```
pieui card dump-metadata MoodCard
pieui card dump-metadata MoodCard --out metadata/MoodCard.json
```

**`pieui card check-sync <Name>`**
Compares TypeScript ↔ Python metadata. Delegates to `pie card check-sync` in the configured backend project (reads `.pie/config.json → backendProjectDir`). Prompts for the path if not configured; writes it back.

Env overrides (pieui side):
- `PIEUI_CHECK_SYNC_PYTHON` — path to Python binary (default: `.venv/bin/python` or `python3`).
- `PIEUI_CHECK_SYNC_PYTHONPATH` — prepended to `PYTHONPATH` when invoking `pie`.

Env overrides (pie side, consumed by `pie card check-sync`):
- `PIE_CHECK_SYNC_PIEUI_CLI` — path to the `pieui` binary that `pie` calls to fetch TypeScript metadata (default: `pieui` on PATH).

Requires non-interactive shell config or `backendProjectDir` in `.pie/config.json`.

---

### Card remote storage

All `card remote` commands require a prior `pieui login`.

**`pieui card remote push <Name>`** — Upload `piecomponents/<Name>/` to PieUI storage.
**`pieui card remote pull <Name>[@rev]`** — Download from storage into `piecomponents/<Name>/`. Optionally pin a revision.
**`pieui card remote list [--user U] [--project S]`** — List remote components for the configured (or specified) user/project.
**`pieui card remote remove <Name>`** — Delete from storage.
**`pieui card remote history <Name> [--page N] [--per-page N] [--from R] [--to R]`** — Revision history with per-file diff stats.
**`pieui card remote public <Name>`** — Make readable as `r/<user>/<Name>` (public alias).
**`pieui card remote private <Name>`** — Revoke public access.

---

### Page management

**`pieui page add <path>`**
Creates `app/<path>/page.tsx` from the standard Pie page template.
```
pieui page add dashboard
pieui page add details/[id]
```

**`pieui page view <path>`**
Prints the current source of `app/<path>/page.tsx`.

**`pieui page ajax <path> <add|remove> <handler>`**
Adds or removes an AJAX handler block in the page. The handler becomes callable from the server as `/api/<path>/<handler>`.
```
pieui page ajax dashboard add refresh_data
pieui page ajax dashboard remove refresh_data
```

---

## Envelope format policy

`dump-metadata` always wraps its output in a typed envelope:

```json
{
  "typescript": { "name": "MoodCard", "files": [...], "events": [...], ... }
}
```

`pie card dump-metadata` (Python CLI) uses the sibling key:

```json
{
  "python": { "name": "MoodCard", "props": {...}, "events": [...], ... }
}
```

**Both CLIs can write to the same file** — `--out` does a shallow-merge at the top level, preserving sibling keys. The combined file is used by `card check-sync` for cross-side comparison.

**TS code never reads `{python: ...}`.** Any code that parses dump-metadata output must unwrap only `obj.typescript`. Passing a Python-only dump to `card pull` or `card add --from` will throw:
```
dump-metadata payload is missing the "typescript" envelope (top-level keys: python)
```

---

## Workflow recipes

### 1. Create a page with an AJAX handler

```bash
pieui page add dashboard
pieui page ajax dashboard add refresh_data
# Edit business logic in app/dashboard/page.tsx — the handler stub is already wired
```

### 2. Create an input-card with events

```bash
pieui card add simple-container InputAdjustmentsCard --ajax
pieui card add-event InputAdjustmentsCard submit
pieui card add-event InputAdjustmentsCard reset
# Edit method bodies in piecomponents/InputAdjustmentsCard/ui/InputAdjustmentsCard.tsx
# <PieCard stored={...} /> is what enables input persistence — add the stored prop to the JSX
```

### 3. Port a card from a Python backend

```bash
# Option A — explicit .py file
pieui card add MyCard --from ../pie/components/my_card.py

# Option B — use configured backendComponentsDir (auto-resolves)
pieui card add MyCard

# Option C — from a previously exported dump
pie card dump-metadata MyCard --out /tmp/MyCard.json
pieui card pull /tmp/MyCard.json
```

After porting, verify the generated types match the backend contract:
```bash
pieui card dump-metadata MyCard --out /tmp/MyCard.json  # writes typescript envelope
pie card dump-metadata MyCard --out /tmp/MyCard.json    # merges python envelope
pieui card check-sync MyCard                            # reads combined file, diffs both sides
```

### 4. Publish a card to remote storage

```bash
pieui login                              # once per machine
pieui card remote push MyCard
pieui card remote history MyCard         # verify upload
pieui card remote public MyCard          # make shareable as r/<user>/MyCard
```

### 5. Install a community card

```bash
pieui card pull r/alice/HeroCard                         # from public alias
pieui card pull https://example.com/exports/HeroCard.json # from URL
```

---

## Edge cases & IntrospectionError

`card dump-metadata` and `card add --from` use static TypeScript analysis. They throw `Error` (not a typed class) in these cases:

| Situation | Error message pattern |
|-----------|----------------------|
| No component directory | `Component directory not found: …` |
| No TS files in component dir | `No files found in …` |
| Data type not found | `Could not find data type for <Name>` |
| `<PieCard methods={...}>` not found or not an inline literal | Events list is empty (no error thrown; check with `card view`) |
| `--out` target exists but is not a JSON object | `Cannot merge: existing file … is not a JSON object` |
| `--from` points to a JSON without `typescript` key | `dump-metadata payload is missing the "typescript" envelope` |
| `card check-sync` in non-interactive shell without config | `Non-interactive shell — add "backendProjectDir" to .pie/config.json` |

**Naming convention**: the data type must be named `<Name>Data`, `I<Name>Data`, or `<Name>Props`. Deviating from this convention will cause `dump-metadata` to fail with a type-not-found error.

**Methods must be an inline literal**: `<PieCard methods={handlers} />` (external variable) will yield zero events. The object must be written inline: `<PieCard methods={{ like: (p) => ... }} />`.
