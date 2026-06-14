# Design: `@swarm.ing/pieui/telegram` and `@swarm.ing/pieui/max` subpath exports

**Date:** 2026-06-14
**Status:** Approved

## Problem

The main `@swarm.ing/pieui` barrel (`src/index.ts`) exports platform-specific
host integrations:

- `PieTelegramRoot` (Telegram Mini Apps root)
- `PieMaxRoot` (MAX / VK Messenger mini-app root)
- `useWebApp` (Telegram WebApp hook)
- `useMaxWebApp` (MAX WebApp hook)

Consumers who never target Telegram or MAX still get this code referenced from
the main entry point. We want platform code to be opt-in: an app that does not
use Telegram should not pull in Telegram code (and vice versa for MAX).

This mirrors the precedent set by `@swarm.ing/pieui/agent`, which was split out
of the main barrel so apps that don't use the OpenAI agent stack never ship it.

## Goal

Move Telegram and MAX host integrations into dedicated subpath exports so they
become separate, opt-in bundle entry points:

- `@swarm.ing/pieui/telegram`
- `@swarm.ing/pieui/max`

After the change, the main barrel must no longer reference Telegram/MAX code, so
it is excluded from the main bundle.

## Non-goals

- No change to the runtime behavior of the roots or hooks.
- No change to the CLI command surface (so cross-repo `pie` symmetry is
  unaffected).
- No new server/Express work (that is a separate effort).

## Key findings (from exploration)

- `components/index.ts` does **not** re-export the roots, so removing the
  explicit export lines from `src/index.ts` fully removes Telegram/MAX from the
  main bundle.
- `@telegram-apps/sdk` is listed in `dependencies` but is **not imported
  anywhere** in `src`. The Telegram/MAX code uses `window.Telegram` /
  `window.WebApp` directly via locally-defined types — no unique third-party
  dependency is pulled in by the platform code.
- The global augmentation `declare global { interface Window { sid; Telegram;
  WebApp } }` lives in `src/types/index.ts` and must remain in a file `tsc`
  includes. `src/types/index.ts` stays in place.
- The only in-repo consumer of `PieTelegramRoot` from the main barrel is a
  template string (`DEFAULT_SHARED_SIMPLE_TSX`) in
  `src/code/commands/createPieApp.ts`.

## Design

### Decisions

- **Hard move** (like `/agent`): remove from the main barrel, leave a NOTE
  comment pointing to the new subpaths. This is a breaking change for the main
  entry point.
- **Thin barrels**: implementation files stay where they are; the new
  `src/telegram/index.ts` and `src/max/index.ts` re-export them. Isolation is
  achieved because the main barrel stops referencing them and each subpath is
  its own bundled entry point. (Lowest risk, consistent with `/agent`.)

### New barrel files

`src/telegram/index.ts` exports:

- `PieTelegramRoot` (from `../components/PieTelegramRoot`)
- `useWebApp`, `useInitData` (from `../util/useWebApp`)
- types from `../types`: `WebApp`, `Telegram`, `InitData`, `InitDataUnsafe`,
  `WebAppUser`, `WebAppInitData`

`src/max/index.ts` exports:

- `PieMaxRoot` (from `../components/PieMaxRoot`)
- `useMaxWebApp`, `useMaxInitData`, `useMaxBackButton`, `useMaxHapticFeedback`
  (from `../util/useMaxWebApp`)
- types from `../types`: `MaxWebApp`, `MaxWebAppData`, `MaxWebAppUser`,
  `MaxWebAppChat`, `MaxWebAppStartParam`

Both barrels begin with `'use client'` (they re-export client components/hooks).

### Shared types

`src/types/index.ts` is unchanged: it keeps all type definitions and the
`declare global` Window augmentation. The subpaths re-export the relevant
subsets.

### Main barrel (`src/index.ts`)

- Remove the four export lines: `PieTelegramRoot`, `PieMaxRoot`, `useWebApp`,
  `useMaxWebApp`.
- Add a NOTE comment (mirroring the existing agent NOTE) explaining the move and
  pointing to `@swarm.ing/pieui/telegram` and `@swarm.ing/pieui/max`.
- `PieRoot` and `PieBaseRoot` remain in the main barrel (generic, not
  platform-specific).

### package.json

- `exports`: add `./telegram` and `./max` blocks (`import` / `require` /
  `types`), mirroring `./agent`.
- `scripts`: add `build:telegram:esm`, `build:telegram:cjs`, `build:max:esm`,
  `build:max:cjs` with the same flags used for `agent`
  (`--jsx=automatic --jsx-import-source=react --minify --packages=external`;
  esm → `--target browser`, cjs → `--target node`). Insert these into the main
  `build` chain after the agent build steps.
- `build:banner`: add the 4 new output files
  (`dist/telegram/index.esm.js`, `dist/telegram/index.js`,
  `dist/max/index.esm.js`, `dist/max/index.js`) to the `'use client'` banner
  list.
- Declaration files: `tsc --emitDeclarationOnly` already covers all of
  `src/**`, so `dist/telegram/index.d.ts` and `dist/max/index.d.ts` are emitted
  automatically.
- Optional cleanup (separate, low priority): remove the unused
  `@telegram-apps/sdk` from `dependencies`.

### In-repo consumer

`src/code/commands/createPieApp.ts`: in the `DEFAULT_SHARED_SIMPLE_TSX`
template, change the import of `PieTelegramRoot` from `@swarm.ing/pieui` to
`@swarm.ing/pieui/telegram`. This touches `src/code/commands/**`, which triggers
the CLI-symmetry hook, but no command/flag/positional changes — symmetry with
`pie` is unaffected, so no change in `../pie` is needed.

## Compatibility

- Breaking change for imports from the main entry point → bump at least a minor
  version (currently 2.0.34). Final version choice deferred to release time.

## Verification

- `bun run build` succeeds; `dist/telegram/` and `dist/max/` exist with
  `.esm.js`, `.js`, and `.d.ts`.
- `bun run typecheck` is clean.
- Confirm the main bundle (`dist/index.esm.js` / `dist/index.js`) no longer
  contains the Telegram/MAX root code (grep for a marker such as
  `__pieroot=telegram` / `__pieroot=max`).
- Resolve `@swarm.ing/pieui/telegram` and `@swarm.ing/pieui/max` and confirm the
  documented symbols are exported with types.
