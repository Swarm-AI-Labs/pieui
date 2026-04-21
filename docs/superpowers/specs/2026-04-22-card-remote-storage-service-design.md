# Design: `pieui card remote` + Storage service (TS port from Python `pie`)

## Goal

Ship a `bunx pieui card remote [push|pull|list|remove] <Name>` command suite that
is functionally and wire-compatible with the Python `pie card remote` family
defined in `/Users/kaspar_george/pie/pie/code/card_remote.py`, adapted for the
pieui directory layout (`piecomponents/<Name>/*` — many files per component).

The Python `PieStorageService` (`pie/code/services/storage.py`) is ported to
TypeScript line-for-line as the transport layer. The old zip-based top-level
`push` / `pull` / `remote-remove` commands are removed.

## Non-goals

- No server-side changes. Endpoints at `https://cdn-pieui.swarm.ing/api/components/...`
  are assumed to already exist and behave as documented in Python.
- No migration tool for users of the old `/external/*` zip API.
- `input` metadata flag is always `false` for pieui — no equivalent of Python's
  `InputCard` base class, and we don't plan to add one.

## User-facing commands

```
pieui card remote push <Name>
pieui card remote pull <Name>
pieui card remote list [--user USER_ID] [--project SLUG]
pieui card remote remove <Name>
```

Config resolution (first wins):

| Setting          | Env var(s)                        | Fallback                          |
| ---------------- | --------------------------------- | --------------------------------- |
| `user_id`        | `PIE_USER_ID`                     | error if not set                  |
| `project`        | `PIE_PROJECT`, `PIE_PROJECT_SLUG` | `path.basename(cwd)`              |
| `api_key`        | `PIE_API_KEY`                     | no `x-api-key` header             |
| `components_dir` | `PIE_COMPONENTS_DIR`              | `piecomponents`                   |
| `api_base_url`   | `PIE_API_BASE_URL`                | `https://cdn-pieui.swarm.ing/api` |

`.env` in cwd is loaded automatically at command time. `list` accepts `--user`
and `--project` to override, matching Python's `pie card remote list` flags.

## Architecture

```
src/code/
├── services/
│   ├── settings.ts      — Settings type + loadSettings() (reads .env, env vars)
│   ├── storage.ts       — PieStorageService (direct TS port of Python)
│   └── models.ts        — ComponentObject, ComponentTree, ProjectComponentList types
├── cardMetadata.ts      — extractCardMetadata(typesIndexSource): { component, input, ajax, io }
└── commands/
    └── cardRemote/
        ├── push.ts      — upload dir + metadata
        ├── pull.ts      — download dir atomically
        ├── list.ts      — list components
        └── remove.ts    — delete component
```

### 1. `services/models.ts`

```ts
export type ComponentObject = {
    key: string
    size?: number
    contentType?: string
    signedUrl?: string
}

export type ComponentTree = {
    prefix: string
    // Server returns per-language groups as siblings of `prefix`,
    // e.g. `{ prefix, typescript: { objects: [{key, ...}, ...] } }`.
    // Kept as an open record to match Python's ConfigDict(extra='allow').
    [language: string]: unknown
}

export type ProjectComponentEntry = { name: string }

export type ProjectComponentList = {
    userId: string
    projectSlug: string
    components: ProjectComponentEntry[]
}
```

Server returns snake_case (`user_id`, `project_slug`). Normalize on parse.

### 2. `services/settings.ts`

```ts
export type Settings = {
    userId?: string
    apiKey?: string
    project: string
    projectSlug: string // alias for project
    componentsDir: string // absolute path
    apiBaseUrl: string // no trailing slash
}

export function loadSettings(cwd?: string): Settings
```

Reads `.env` via a minimal parser (no new dep; single file, `KEY=value` + quoted
values, ignore `#` comments). We already have `.env` writing logic in
`login.ts` — reuse / share primitives.

### 3. `services/storage.ts`

Public API (mirrors Python method names in camelCase):

```ts
export class PieStorageError extends Error {}

export class PieStorageService {
    constructor(settings: Settings)

    listProjectComponents(args: {
        userId: string
        projectSlug: string
    }): Promise<ProjectComponentList>
    listComponent(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): Promise<ComponentTree>
    deleteComponent(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): Promise<void>

    uploadComponentDirectory(args: {
        componentName: string
        sourceDir: string
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject[]>
    uploadLanguageFilesBatch(args: {
        componentName: string
        files: Array<[string, string]>
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject[]>
    uploadLanguageFile(args: {
        componentName: string
        objectPath: string
        filePath: string
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject>

    downloadComponentDirectory(args: {
        componentName: string
        targetDir: string
        userId?: string
        projectSlug?: string
    }): Promise<string[]>
    downloadLanguageFile(args: {
        componentName: string
        objectPath: string
        targetPath: string
        userId?: string
        projectSlug?: string
    }): Promise<string>
    deleteLanguageFile(args: {
        componentName: string
        objectPath: string
        userId?: string
        projectSlug?: string
    }): Promise<void>

    uploadMetadataContent(args: {
        componentName: string
        schemaKind: 'jsonSchema' | 'eventSchema' | 'llms.txt'
        content: Uint8Array
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject>
    downloadMetadata(args: {
        componentName: string
        schemaKind: string
        targetPath: string
        userId?: string
        projectSlug?: string
    }): Promise<string>
    deleteMetadata(args: {
        componentName: string
        schemaKind: string
        userId?: string
        projectSlug?: string
    }): Promise<void>
}
```

Constants:

```ts
const STORAGE_LANGUAGE = 'typescript'
const METADATA_CONTENT_TYPES = {
    jsonSchema: 'application/json',
    eventSchema: 'application/json',
    'llms.txt': 'text/plain',
}
const DEFAULT_TIMEOUT_MS = 30_000
```

URL construction mirrors Python 1:1:

- `GET /components/{user}/{slug}` → `listProjectComponents`
- `GET/DELETE /components/{user}/{slug}/{name}` → `listComponent` / `deleteComponent`
- `PUT /components/{user}/{slug}/{name}/batch/typescript` (multipart) → `uploadLanguageFilesBatch`
- `PUT/GET/DELETE /components/{user}/{slug}/{name}/typescript/{path}` → single-file ops
- `PUT/GET/DELETE /components/{user}/{slug}/{name}/metadata/{schemaKind}` → metadata ops

Transport: `fetch` (native). Headers: `{ 'x-api-key': apiKey }` when present.
Timeout via `AbortController`. Errors wrapped as `PieStorageError` with
`METHOD URL failed: STATUS\nBODY` shape (matches Python `_raise_for_error`).
Connection-refused / abort / DNS errors produce clean messages (no raw stack) —
matches existing step2-remote test expectations.

Path safety: `_normalize_object_path` rejects `.` / `..` / empty segments /
leading `/` — identical rules to Python.

Multipart upload for batch PUT:

- One `object_paths` field per file (plain-text, relative POSIX path)
- One `files` field per file with the corresponding file body + guessed content-type
- `object_paths[i]` corresponds to `files[i]`
- Built with native `FormData` + `File` (already used in the current `push.ts`)

### 4. `cardMetadata.ts`

```ts
export type CardMetadata = {
    component: string
    input: false // always false for pieui
    ajax: boolean
    io: boolean
}

export function extractCardMetadata(
    componentName: string,
    typesIndexSource: string
): CardMetadata
```

Detection: plain-text field-name regex on the file (skipping string/comment
nuance is fine — false positives are acceptable, since the scaffold is the
only expected input).

- `ajax = true` iff source contains any identifier from
  `{ pathname, depsNames, kwargs }` as a word match
- `io = true` iff source contains any identifier from
  `{ useSocketioSupport, useCentrifugeSupport, useMittSupport, centrifugeChannel }`

If `types/index.ts` doesn't exist: `ajax = false`, `io = false` (no error —
user may have a hand-rolled component).

Metadata is serialized exactly like Python for byte-compatible payloads:
`JSON.stringify(obj, keys_sorted) + '\n'`, utf-8 bytes.

### 5. Command handlers

**`commands/cardRemote/push.ts`**

1. `settings = loadSettings()`; require `userId` and validate `componentName` shape (`/^[A-Z][A-Za-z0-9]+$/`)
2. `componentDir = path.join(settings.componentsDir, componentName)`; error if missing
3. `service.uploadComponentDirectory({ componentName, sourceDir: componentDir })` — all files posted relative to `componentDir`
4. Read `piecomponents/<Name>/types/index.ts` if present; call `extractCardMetadata`
5. `service.uploadMetadataContent({ componentName, schemaKind: 'eventSchema', content: <json bytes> })`
6. Log: uploaded file count, remote prefix, metadata key, and the ajax/io flags

**`commands/cardRemote/pull.ts`**

1. Require `userId` and `project`
2. Create `componentDir.pieui-tmp-<pid>-<ts>/`
3. `service.downloadComponentDirectory({ componentName, targetDir: tmpDir })` — writes each file under the language prefix
4. If tmp is non-empty: delete existing `componentDir`, rename tmp → `componentDir`
5. If tmp is empty: clean up tmp, throw "no typescript files found for remote component"

**`commands/cardRemote/list.ts`**

1. Resolve `userId = cliUser || settings.userId`, `slug = cliProject || settings.project`
2. `service.listProjectComponents({ userId, projectSlug: slug })`
3. Print header, then sorted names one per line

**`commands/cardRemote/remove.ts`**

1. Require `userId` and `project`
2. `service.deleteComponent({ componentName })`
3. Log success

## CLI wiring changes

`src/code/types.ts`:

- Add `CardRemoteAction = 'push' | 'pull' | 'list' | 'remove'`
- Extend `CardAction` to `'add' | 'remote'`
- Add `cardRemoteAction?`, `remoteUserId?`, `remoteProjectSlug?` to `ParsedArgs`

`src/code/args.ts`:

- In the `command === 'card'` branch, detect `argv[1] === 'remote'` and parse
  the next token as `cardRemoteAction`, then positional component name and the
  `--user` / `--project` flags
- Remove the old `pull` / `push` / `remote-remove` parsing branches

`src/cli.ts`:

- In the `'card'` case: if `cardAction === 'remote'`, dispatch to the four new
  handlers based on `cardRemoteAction`
- Delete the top-level `'push'` / `'pull'` / `'remote-remove'` cases
- Delete `pushCommand` / `pullCommand` / `remoteRemoveCommand` imports

`printUsage()`:

- Drop `push <Name>` / `pull <Name>` / `remote-remove <Name>` lines
- Add `card remote push|pull|list|remove <Name>` and examples

Files to delete:

- `src/code/commands/push.ts`
- `src/code/commands/pull.ts`
- `src/code/commands/remoteRemove.ts`

## Tests

Rewrite `src/__tests__/step2-remote.test.cjs` targeting the new surface.
Reuse the existing `http.createServer` / `parseMultipartParts` / `runCli`
helpers. Each test spins up a mock server on an ephemeral port and sets
`PIE_API_BASE_URL` in the child env.

Covered cases (minimum):

- `card remote push AlertsCard`
    - walks `piecomponents/AlertsCard/` recursively
    - sends **PUT** to `/components/demo-user/demo/AlertsCard/batch/typescript`
    - multipart body has one `object_paths` per file + one `files` per file, paths are POSIX-relative (incl. nested `ui/view.tsx`)
    - sends follow-up **PUT** to `/components/.../metadata/eventSchema` with content-type `application/json` and body matching `{component, input, ajax, io}` with sorted keys
    - sends `x-api-key` when `PIE_API_KEY` is set; omits when not
    - surfaces 5xx with server body
- `card remote push` fails when component dir missing, when `PIE_USER_ID` unset
- `card remote pull SyncCard`
    - **GET** `/components/.../SyncCard`, then **GET** per-file under the typescript prefix
    - writes into a temp dir and swaps into `piecomponents/SyncCard/` atomically
    - overwrites existing dir contents
    - rejects unsafe object paths
    - 4xx / connection-refused → clean error (no stack trace)
- `card remote list`
    - **GET** `/components/demo-user/demo`
    - prints sorted `components[].name`
    - `--user` / `--project` override env settings
    - error when neither env nor flag provides user/project
- `card remote remove`
    - **DELETE** `/components/demo-user/demo/LegacyCard`
    - surfaces 404 with server body
- Unit tests for `extractCardMetadata`:
    - `--ajax` template → `{ ajax: true, io: false }`
    - `--io` template → `{ ajax: false, io: true }`
    - `--ajax --io` → both true
    - bare template → both false
    - missing file → both false, no throw
- Args required: `card remote push`, `pull`, `remove` without a name → exit 1
- Legacy `push` / `pull` / `remote-remove` commands no longer accepted (exit 1 with usage)

## Risks / open points

- **Server response shape** for `ComponentTree`. Python uses
  `ConfigDict(extra='allow')` and reads `tree_data[STORAGE_LANGUAGE]['objects']`.
  The TS port keeps an open record type and does the same. If the server
  returns something other than `typescript` as the language key for pieui
  components, pull will silently return empty. This is the same behavior as
  Python and should surface a clear error when `downloaded.length === 0`.
- **`.env` parsing**: the `login.ts` path already writes `.env`, so we'll reuse
  its primitives. If no minimal shared parser exists yet, we introduce
  `parseDotenv(content: string): Record<string,string>` in
  `services/settings.ts` — ~30 lines, no new dependency. Python uses
  `python-dotenv`; we don't need a dep for a file format this small.
- **`input` flag**: emitted as `false` always. Called out in a code comment
  and in the spec. If the server rejects unknown fields we'll revisit.
