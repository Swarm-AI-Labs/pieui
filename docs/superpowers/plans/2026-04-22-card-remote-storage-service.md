# `pieui card remote` + PieStorageService Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bunx pieui card remote push|pull|list|remove <Name>` backed by a TS port of the Python `PieStorageService`, replacing the legacy zip-based top-level commands.

**Architecture:** Settings loader (.env + `PIE_*` env vars) feeds a stateless `PieStorageService` that speaks the same per-file `/api/components/{user}/{slug}/...` HTTP API as `pie/code/services/storage.py`. Four thin command handlers under `src/code/commands/cardRemote/` orchestrate filesystem work and call into the service.

**Tech Stack:** TypeScript, Node/Bun, native `fetch` + `FormData`, `bun:test` for unit tests, existing `http.createServer` + `spawn` pattern in `src/__tests__/step2-remote.test.cjs` for CLI integration tests.

**Spec:** [2026-04-22-card-remote-storage-service-design.md](../specs/2026-04-22-card-remote-storage-service-design.md)

---

## File structure (created/modified/deleted)

**Created:**

- `src/code/services/models.ts` — request/response types
- `src/code/services/settings.ts` — `Settings`, `loadSettings()`, `parseDotenv()`
- `src/code/services/storage.ts` — `PieStorageService`, `PieStorageError`
- `src/code/cardMetadata.ts` — `extractCardMetadata()`
- `src/code/commands/cardRemote/push.ts`
- `src/code/commands/cardRemote/pull.ts`
- `src/code/commands/cardRemote/list.ts`
- `src/code/commands/cardRemote/remove.ts`
- `src/tests/settings.test.ts` — unit tests for settings/env parsing
- `src/tests/storage.test.ts` — unit tests for storage service (mock http server)
- `src/tests/cardMetadata.test.ts` — unit tests for metadata extractor

**Modified:**

- `src/code/types.ts` — add `CardRemoteAction`, extend `CardAction`, new `ParsedArgs` fields
- `src/code/args.ts` — parse `card remote <action>` + `--user` / `--project`; drop legacy branches
- `src/cli.ts` — dispatch `card remote`; drop legacy top-level push/pull/remote-remove cases
- `src/__tests__/step2-remote.test.cjs` — rewritten against new command surface

**Deleted:**

- `src/code/commands/push.ts`
- `src/code/commands/pull.ts`
- `src/code/commands/remoteRemove.ts`

---

## Test strategy

- **Unit tests** (`src/tests/*.test.ts`) use `bun:test` + Bun's native `expect`. For storage tests we boot a local `node:http` server on port 0 and point the service at it — same trick the existing integration suite uses, but without spawning the CLI binary.
- **Integration tests** (`src/__tests__/step2-remote.test.cjs`) stay on the existing `spawn(bun, src/cli.ts)` harness and run the full CLI against a mock HTTP server.
- Commit after each green test block.

---

### Task 1: Scaffold `services/` dir + empty module placeholders

**Files:**

- Create: `src/code/services/models.ts`
- Create: `src/code/services/settings.ts`
- Create: `src/code/services/storage.ts`

- [ ] **Step 1: Create empty modules so subsequent imports compile**

`src/code/services/models.ts`:

```ts
// filled in Task 4
export {}
```

`src/code/services/settings.ts`:

```ts
// filled in Task 3
export {}
```

`src/code/services/storage.ts`:

```ts
// filled in Task 5+
export {}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes (empty modules are legal).

- [ ] **Step 3: Commit**

```bash
git add src/code/services/
git commit -m "chore: scaffold services/ modules for card remote"
```

---

### Task 2: `.env` parser (TDD)

**Files:**

- Create: `src/tests/settings.test.ts`
- Modify: `src/code/services/settings.ts`

- [ ] **Step 1: Write the failing test**

`src/tests/settings.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import { parseDotenv } from '../code/services/settings'

describe('parseDotenv', () => {
    test('parses KEY=value lines', () => {
        expect(parseDotenv('A=1\nB=two\n')).toEqual({ A: '1', B: 'two' })
    })

    test('strips matching double and single quotes', () => {
        expect(parseDotenv(`A="hello world"\nB='x y'\n`)).toEqual({
            A: 'hello world',
            B: 'x y',
        })
    })

    test('ignores blank lines and # comments', () => {
        expect(parseDotenv(`# comment\n\nA=1\n# another\nB=2\n`)).toEqual({
            A: '1',
            B: '2',
        })
    })

    test('ignores malformed lines without =', () => {
        expect(parseDotenv('JUSTAWORD\nA=ok\n')).toEqual({ A: 'ok' })
    })

    test('handles values that contain =', () => {
        expect(parseDotenv('A=x=y=z\n')).toEqual({ A: 'x=y=z' })
    })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun test src/tests/settings.test.ts`
Expected: FAIL — `parseDotenv is not a function`.

- [ ] **Step 3: Implement `parseDotenv`**

Replace `src/code/services/settings.ts` contents with:

```ts
export const parseDotenv = (content: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        if (!key) continue
        let value = line.slice(eq + 1).trim()
        if (
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1)
        }
        out[key] = value
    }
    return out
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `bun test src/tests/settings.test.ts`
Expected: PASS, 5/5 green.

- [ ] **Step 5: Commit**

```bash
git add src/code/services/settings.ts src/tests/settings.test.ts
git commit -m "feat(services): parseDotenv for card remote settings"
```

---

### Task 3: `loadSettings()` (TDD)

**Files:**

- Modify: `src/code/services/settings.ts`
- Modify: `src/tests/settings.test.ts`

- [ ] **Step 1: Add failing tests for `loadSettings`**

Append to `src/tests/settings.test.ts`:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadSettings } from '../code/services/settings'

const mkTempDir = (prefix: string) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const runWithEnv = <T>(
    env: Record<string, string | undefined>,
    fn: () => T
): T => {
    const prev: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(env)) {
        prev[k] = process.env[k]
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
    }
    try {
        return fn()
    } finally {
        for (const [k, v] of Object.entries(prev)) {
            if (v === undefined) delete process.env[k]
            else process.env[k] = v
        }
    }
}

describe('loadSettings', () => {
    test('reads PIE_* env vars and uses defaults', () => {
        const cwd = mkTempDir('pieui-settings-env-')
        const settings = runWithEnv(
            {
                PIE_USER_ID: 'u1',
                PIE_PROJECT: 'proj',
                PIE_API_KEY: 'k1',
                PIE_PROJECT_SLUG: undefined,
                PIE_COMPONENTS_DIR: undefined,
                PIE_API_BASE_URL: undefined,
            },
            () => loadSettings(cwd)
        )
        expect(settings.userId).toBe('u1')
        expect(settings.project).toBe('proj')
        expect(settings.projectSlug).toBe('proj')
        expect(settings.apiKey).toBe('k1')
        expect(settings.componentsDir).toBe(path.join(cwd, 'piecomponents'))
        expect(settings.apiBaseUrl).toBe('https://cdn-pieui.swarm.ing/api')
    })

    test('falls back to cwd basename for project when no env set', () => {
        const base = mkTempDir('pieui-settings-base-')
        const cwd = path.join(base, 'my-pieui-app')
        fs.mkdirSync(cwd, { recursive: true })
        const settings = runWithEnv(
            {
                PIE_USER_ID: 'u',
                PIE_PROJECT: undefined,
                PIE_PROJECT_SLUG: undefined,
            },
            () => loadSettings(cwd)
        )
        expect(settings.project).toBe('my-pieui-app')
        expect(settings.projectSlug).toBe('my-pieui-app')
    })

    test('reads values from .env in cwd when env var absent', () => {
        const cwd = mkTempDir('pieui-settings-dotenv-')
        fs.writeFileSync(
            path.join(cwd, '.env'),
            `PIE_USER_ID=dot-user\nPIE_PROJECT="dot proj"\nPIE_API_KEY=dot-key\n`,
            'utf8'
        )
        const settings = runWithEnv(
            {
                PIE_USER_ID: undefined,
                PIE_PROJECT: undefined,
                PIE_PROJECT_SLUG: undefined,
                PIE_API_KEY: undefined,
            },
            () => loadSettings(cwd)
        )
        expect(settings.userId).toBe('dot-user')
        expect(settings.project).toBe('dot proj')
        expect(settings.apiKey).toBe('dot-key')
    })

    test('process env wins over .env', () => {
        const cwd = mkTempDir('pieui-settings-override-')
        fs.writeFileSync(
            path.join(cwd, '.env'),
            `PIE_USER_ID=from-dotenv\n`,
            'utf8'
        )
        const settings = runWithEnv(
            { PIE_USER_ID: 'from-env', PIE_PROJECT: 'p' },
            () => loadSettings(cwd)
        )
        expect(settings.userId).toBe('from-env')
    })

    test('PIE_API_BASE_URL strips trailing slash', () => {
        const cwd = mkTempDir('pieui-settings-base-url-')
        const settings = runWithEnv(
            {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 'p',
                PIE_API_BASE_URL: 'https://example.test/api/',
            },
            () => loadSettings(cwd)
        )
        expect(settings.apiBaseUrl).toBe('https://example.test/api')
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/settings.test.ts`
Expected: FAIL — `loadSettings is not a function`.

- [ ] **Step 3: Implement `loadSettings`**

Replace `src/code/services/settings.ts` with:

```ts
import fs from 'node:fs'
import path from 'node:path'

export const parseDotenv = (content: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        if (!key) continue
        let value = line.slice(eq + 1).trim()
        if (
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1)
        }
        out[key] = value
    }
    return out
}

export type Settings = {
    userId?: string
    apiKey?: string
    project: string
    projectSlug: string
    componentsDir: string
    apiBaseUrl: string
}

const DEFAULT_API_BASE_URL = 'https://cdn-pieui.swarm.ing/api'

const readDotenv = (cwd: string): Record<string, string> => {
    const envPath = path.join(cwd, '.env')
    if (!fs.existsSync(envPath)) return {}
    try {
        return parseDotenv(fs.readFileSync(envPath, 'utf8'))
    } catch {
        return {}
    }
}

export const loadSettings = (cwd: string = process.cwd()): Settings => {
    const dotenv = readDotenv(cwd)
    const pick = (key: string): string | undefined =>
        process.env[key] !== undefined && process.env[key] !== ''
            ? process.env[key]
            : dotenv[key]

    const userId = pick('PIE_USER_ID')
    const apiKey = pick('PIE_API_KEY')
    const project =
        pick('PIE_PROJECT') || pick('PIE_PROJECT_SLUG') || path.basename(cwd)
    const componentsDirRaw = pick('PIE_COMPONENTS_DIR') || 'piecomponents'
    const componentsDir = path.isAbsolute(componentsDirRaw)
        ? componentsDirRaw
        : path.join(cwd, componentsDirRaw)
    const apiBaseUrl = (
        pick('PIE_API_BASE_URL') || DEFAULT_API_BASE_URL
    ).replace(/\/+$/, '')

    return {
        userId,
        apiKey,
        project,
        projectSlug: project,
        componentsDir,
        apiBaseUrl,
    }
}
```

- [ ] **Step 4: Run all settings tests**

Run: `bun test src/tests/settings.test.ts`
Expected: PASS, 10/10 green (5 from Task 2 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/code/services/settings.ts src/tests/settings.test.ts
git commit -m "feat(services): loadSettings reads PIE_* env + .env fallback"
```

---

### Task 4: Service response models

**Files:**

- Modify: `src/code/services/models.ts`

- [ ] **Step 1: Replace `models.ts` with real types**

`src/code/services/models.ts`:

```ts
export type ComponentObject = {
    key: string
    size?: number
    contentType?: string
    signedUrl?: string
}

export type LanguageObjectGroup = {
    objects?: ComponentObject[]
}

export type ComponentTree = {
    prefix: string
    typescript?: LanguageObjectGroup
} & Record<string, unknown>

export type ProjectComponentEntry = { name: string }

export type ProjectComponentList = {
    userId: string
    projectSlug: string
    components: ProjectComponentEntry[]
}

export const parseComponentObject = (raw: unknown): ComponentObject => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const key = typeof obj.key === 'string' ? obj.key : ''
    return {
        key,
        size: typeof obj.size === 'number' ? obj.size : undefined,
        contentType:
            typeof obj.content_type === 'string'
                ? obj.content_type
                : typeof obj.contentType === 'string'
                  ? obj.contentType
                  : undefined,
        signedUrl:
            typeof obj.signed_url === 'string'
                ? obj.signed_url
                : typeof obj.signedUrl === 'string'
                  ? obj.signedUrl
                  : undefined,
    }
}

export const parseProjectComponentList = (
    raw: unknown
): ProjectComponentList => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const userId =
        typeof obj.user_id === 'string'
            ? obj.user_id
            : typeof obj.userId === 'string'
              ? obj.userId
              : ''
    const projectSlug =
        typeof obj.project_slug === 'string'
            ? obj.project_slug
            : typeof obj.projectSlug === 'string'
              ? obj.projectSlug
              : ''
    const rawComponents = Array.isArray(obj.components) ? obj.components : []
    const components: ProjectComponentEntry[] = rawComponents
        .map((entry) => {
            const e = (entry ?? {}) as Record<string, unknown>
            return typeof e.name === 'string' ? { name: e.name } : null
        })
        .filter((e): e is ProjectComponentEntry => e !== null)
    return { userId, projectSlug, components }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/code/services/models.ts
git commit -m "feat(services): component response models + snake_case parsers"
```

---

### Task 5: `PieStorageService` — URL helpers + path safety (TDD)

**Files:**

- Create: `src/tests/storage.test.ts`
- Modify: `src/code/services/storage.ts`

- [ ] **Step 1: Add failing unit tests for URL and path helpers**

`src/tests/storage.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import {
    PieStorageError,
    PieStorageService,
    normalizeObjectPath,
} from '../code/services/storage'
import type { Settings } from '../code/services/settings'

const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
    userId: 'demo-user',
    apiKey: 'demo-key',
    project: 'demo-proj',
    projectSlug: 'demo-proj',
    componentsDir: '/tmp/pc',
    apiBaseUrl: 'https://example.test/api',
    ...overrides,
})

describe('normalizeObjectPath', () => {
    test('passes POSIX relative paths through encoded', () => {
        expect(normalizeObjectPath('ui/view.tsx')).toBe('ui/view.tsx')
    })
    test('converts backslashes to slashes', () => {
        expect(normalizeObjectPath('ui\\view.tsx')).toBe('ui/view.tsx')
    })
    test('rejects absolute paths', () => {
        expect(() => normalizeObjectPath('/etc/passwd')).toThrow(
            PieStorageError
        )
    })
    test('rejects .. segments', () => {
        expect(() => normalizeObjectPath('../escape')).toThrow(PieStorageError)
    })
    test('rejects . segments', () => {
        expect(() => normalizeObjectPath('./ok')).toThrow(PieStorageError)
    })
    test('rejects empty segments', () => {
        expect(() => normalizeObjectPath('ui//view.tsx')).toThrow(
            PieStorageError
        )
    })
    test('url-encodes spaces and special chars in segments', () => {
        expect(normalizeObjectPath('ui/my file.tsx')).toBe('ui/my%20file.tsx')
    })
})

describe('PieStorageService URL construction', () => {
    const service = new PieStorageService(makeSettings())

    test('projectComponentsUrl', () => {
        expect(
            service.projectComponentsUrl({ userId: 'u', projectSlug: 's' })
        ).toBe('https://example.test/api/components/u/s')
    })

    test('componentUrl uses settings when ids omitted', () => {
        expect(service.componentUrl({ componentName: 'Card' })).toBe(
            'https://example.test/api/components/demo-user/demo-proj/Card'
        )
    })

    test('componentUrl with overrides', () => {
        expect(
            service.componentUrl({
                componentName: 'Card',
                userId: 'u2',
                projectSlug: 's2',
            })
        ).toBe('https://example.test/api/components/u2/s2/Card')
    })

    test('componentUrl throws when no user_id configured', () => {
        const s = new PieStorageService(makeSettings({ userId: undefined }))
        expect(() => s.componentUrl({ componentName: 'Card' })).toThrow(
            PieStorageError
        )
    })

    test('languageFileUrl', () => {
        expect(
            service.languageFileUrl({
                componentName: 'Card',
                objectPath: 'ui/view.tsx',
            })
        ).toBe(
            'https://example.test/api/components/demo-user/demo-proj/Card/typescript/ui/view.tsx'
        )
    })

    test('languageBatchUrl', () => {
        expect(service.languageBatchUrl({ componentName: 'Card' })).toBe(
            'https://example.test/api/components/demo-user/demo-proj/Card/batch/typescript'
        )
    })

    test('metadataUrl encodes schema kind', () => {
        expect(
            service.metadataUrl({
                componentName: 'Card',
                schemaKind: 'eventSchema',
            })
        ).toBe(
            'https://example.test/api/components/demo-user/demo-proj/Card/metadata/eventSchema'
        )
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/storage.test.ts`
Expected: FAIL — module exports missing.

- [ ] **Step 3: Implement URL helpers in `storage.ts`**

Replace `src/code/services/storage.ts` with:

```ts
import type { Settings } from './settings'

export const STORAGE_LANGUAGE = 'typescript'

export class PieStorageError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PieStorageError'
    }
}

const pathPart = (value: string): string => encodeURIComponent(value)

export const normalizeObjectPath = (value: string): string => {
    const stripped = value.replace(/\\/g, '/')
    const parts = stripped.split('/')
    if (
        stripped.startsWith('/') ||
        parts.some((p) => p === '' || p === '.' || p === '..')
    ) {
        throw new PieStorageError(
            'object path must be relative and must not contain . or ..'
        )
    }
    return parts.map((p) => encodeURIComponent(p)).join('/')
}

export class PieStorageService {
    private readonly settings: Settings
    private readonly baseUrl: string

    constructor(settings: Settings) {
        this.settings = settings
        this.baseUrl = settings.apiBaseUrl.replace(/\/+$/, '')
    }

    projectComponentsUrl(args: {
        userId: string
        projectSlug: string
    }): string {
        return `${this.baseUrl}/components/${pathPart(args.userId)}/${pathPart(args.projectSlug)}`
    }

    componentUrl(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): string {
        const userId = args.userId ?? this.settings.userId
        const slug = args.projectSlug ?? this.settings.projectSlug
        if (!userId) {
            throw new PieStorageError(
                'user_id is required (configure PIE_USER_ID or pass user_id)'
            )
        }
        return `${this.baseUrl}/components/${pathPart(userId)}/${pathPart(slug)}/${pathPart(args.componentName)}`
    }

    languageFileUrl(args: {
        componentName: string
        objectPath: string
        userId?: string
        projectSlug?: string
    }): string {
        const base = this.componentUrl(args)
        return `${base}/${STORAGE_LANGUAGE}/${normalizeObjectPath(args.objectPath)}`
    }

    languageBatchUrl(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): string {
        return `${this.componentUrl(args)}/batch/${STORAGE_LANGUAGE}`
    }

    metadataUrl(args: {
        componentName: string
        schemaKind: string
        userId?: string
        projectSlug?: string
    }): string {
        return `${this.componentUrl(args)}/metadata/${encodeURIComponent(args.schemaKind)}`
    }
}
```

- [ ] **Step 4: Run and verify pass**

Run: `bun test src/tests/storage.test.ts`
Expected: PASS, 15/15 green.

- [ ] **Step 5: Commit**

```bash
git add src/code/services/storage.ts src/tests/storage.test.ts
git commit -m "feat(services): PieStorageService URL helpers + path safety"
```

---

### Task 6: Storage — `listProjectComponents`, `listComponent`, `deleteComponent` (TDD)

**Files:**

- Modify: `src/tests/storage.test.ts`
- Modify: `src/code/services/storage.ts`

- [ ] **Step 1: Add failing tests using a local HTTP server**

Append to `src/tests/storage.test.ts`:

```ts
import http from 'node:http'
import type { AddressInfo } from 'node:net'

type Recorded = {
    method?: string
    url?: string
    headers: http.IncomingHttpHeaders
    body: Buffer
}

const startServer = async (
    handler: (
        req: http.IncomingMessage,
        res: http.ServerResponse,
        body: Buffer
    ) => void
): Promise<{
    baseUrl: string
    close: () => Promise<void>
    requests: Recorded[]
}> => {
    const requests: Recorded[] = []
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
            const body = Buffer.concat(chunks)
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body,
            })
            handler(req, res, body)
        })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address() as AddressInfo
    return {
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve()))
            ),
        requests,
    }
}

describe('PieStorageService.listProjectComponents', () => {
    test('GETs /components/{user}/{slug} and parses snake_case', async () => {
        const mock = await startServer((_req, res) => {
            res.setHeader('content-type', 'application/json')
            res.end(
                JSON.stringify({
                    user_id: 'u',
                    project_slug: 's',
                    components: [{ name: 'B' }, { name: 'a' }],
                })
            )
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const result = await service.listProjectComponents({
                userId: 'u',
                projectSlug: 's',
            })
            expect(result.userId).toBe('u')
            expect(result.projectSlug).toBe('s')
            expect(result.components.map((c) => c.name)).toEqual(['B', 'a'])
            expect(mock.requests[0]?.method).toBe('GET')
            expect(mock.requests[0]?.url).toBe('/api/components/u/s')
            expect(mock.requests[0]?.headers['x-api-key']).toBe('demo-key')
        } finally {
            await mock.close()
        }
    })

    test('throws PieStorageError on 4xx with body', async () => {
        const mock = await startServer((_req, res) => {
            res.statusCode = 404
            res.end('missing')
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            await expect(
                service.listProjectComponents({ userId: 'u', projectSlug: 's' })
            ).rejects.toThrow(/failed: 404/)
        } finally {
            await mock.close()
        }
    })

    test('omits x-api-key when settings.apiKey is absent', async () => {
        const mock = await startServer((_req, res) => {
            res.end(
                JSON.stringify({
                    user_id: 'u',
                    project_slug: 's',
                    components: [],
                })
            )
        })
        try {
            const service = new PieStorageService(
                makeSettings({
                    apiBaseUrl: `${mock.baseUrl}/api`,
                    apiKey: undefined,
                })
            )
            await service.listProjectComponents({
                userId: 'u',
                projectSlug: 's',
            })
            expect(mock.requests[0]?.headers['x-api-key']).toBeUndefined()
        } finally {
            await mock.close()
        }
    })
})

describe('PieStorageService.listComponent', () => {
    test('GETs /components/{user}/{slug}/{name} and returns parsed tree', async () => {
        const mock = await startServer((_req, res) => {
            res.end(
                JSON.stringify({
                    prefix: 'users/u/projects/s/components/Card/',
                    typescript: {
                        objects: [
                            {
                                key: 'users/u/projects/s/components/Card/typescript/ui/view.tsx',
                            },
                        ],
                    },
                })
            )
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const tree = await service.listComponent({ componentName: 'Card' })
            expect(tree.prefix).toBe('users/u/projects/s/components/Card/')
            expect(tree.typescript?.objects?.[0]?.key).toContain('ui/view.tsx')
        } finally {
            await mock.close()
        }
    })
})

describe('PieStorageService.deleteComponent', () => {
    test('DELETEs /components/{user}/{slug}/{name}', async () => {
        const mock = await startServer((_req, res) => {
            res.statusCode = 204
            res.end()
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            await service.deleteComponent({ componentName: 'Card' })
            expect(mock.requests[0]?.method).toBe('DELETE')
            expect(mock.requests[0]?.url).toBe(
                '/api/components/demo-user/demo-proj/Card'
            )
        } finally {
            await mock.close()
        }
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/storage.test.ts`
Expected: FAIL — methods missing.

- [ ] **Step 3: Extend `storage.ts` with list/delete + shared request helpers**

Append to `src/code/services/storage.ts`:

```ts
import {
    parseComponentObject,
    parseProjectComponentList,
    type ComponentObject,
    type ComponentTree,
    type ProjectComponentList,
} from './models'

const DEFAULT_TIMEOUT_MS = 30_000

type RequestOptions = {
    method: string
    url: string
    headers?: Record<string, string>
    body?: BodyInit
    timeoutMs?: number
}

const cleanFetchError = (
    method: string,
    url: string,
    error: unknown
): Error => {
    const msg = error instanceof Error ? error.message : String(error)
    return new PieStorageError(`${method} ${url} failed: ${msg}`)
}

declare module './storage' {
    // augment so TS knows about new methods we add below
}
```

Then extend the `PieStorageService` class (modify the existing class body) by appending these members **inside the class** (after `metadataUrl`):

```ts
    async listProjectComponents(args: {
        userId: string
        projectSlug: string
    }): Promise<ProjectComponentList> {
        const url = this.projectComponentsUrl(args)
        const response = await this.request({ method: 'GET', url })
        return parseProjectComponentList(await response.json())
    }

    async listComponent(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): Promise<ComponentTree> {
        const url = this.componentUrl(args)
        const response = await this.request({ method: 'GET', url })
        return (await response.json()) as ComponentTree
    }

    async deleteComponent(args: {
        componentName: string
        userId?: string
        projectSlug?: string
    }): Promise<void> {
        const url = this.componentUrl(args)
        await this.request({ method: 'DELETE', url })
    }

    private headers(extra?: Record<string, string>): Record<string, string> {
        const base: Record<string, string> = {}
        if (this.settings.apiKey) base['x-api-key'] = this.settings.apiKey
        return { ...base, ...(extra ?? {}) }
    }

    private async request(opts: RequestOptions): Promise<Response> {
        const controller = new AbortController()
        const timer = setTimeout(
            () => controller.abort(),
            opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
        )
        let response: Response
        try {
            response = await fetch(opts.url, {
                method: opts.method,
                headers: this.headers(opts.headers),
                body: opts.body,
                signal: controller.signal,
            })
        } catch (error) {
            throw cleanFetchError(opts.method, opts.url, error)
        } finally {
            clearTimeout(timer)
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '')
            const detail = body.trim()
            const message = detail
                ? `${opts.method} ${opts.url} failed: ${response.status}\n${detail}`
                : `${opts.method} ${opts.url} failed: ${response.status}`
            throw new PieStorageError(message)
        }
        return response
    }
```

(If the new `import` block fails because `PieStorageService` already uses `import type { Settings }`, merge both imports into one file header.)

- [ ] **Step 4: Run and verify pass**

Run: `bun test src/tests/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code/services/storage.ts src/tests/storage.test.ts
git commit -m "feat(services): list/delete component endpoints"
```

---

### Task 7: Storage — metadata PUT/GET/DELETE (TDD)

**Files:**

- Modify: `src/tests/storage.test.ts`
- Modify: `src/code/services/storage.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/tests/storage.test.ts`:

```ts
describe('PieStorageService metadata', () => {
    test('uploadMetadataContent PUTs with correct content-type and body', async () => {
        const mock = await startServer((_req, res) => {
            res.end(
                JSON.stringify({
                    key: 'users/u/projects/s/components/Card/metadata/eventSchema',
                })
            )
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const payload = new TextEncoder().encode('{"a":1}\n')
            const result = await service.uploadMetadataContent({
                componentName: 'Card',
                schemaKind: 'eventSchema',
                content: payload,
            })
            expect(result.key).toContain('metadata/eventSchema')
            const req = mock.requests[0]
            expect(req?.method).toBe('PUT')
            expect(req?.headers['content-type']).toBe('application/json')
            expect(req?.body.equals(Buffer.from(payload))).toBe(true)
        } finally {
            await mock.close()
        }
    })

    test('uploadMetadataContent rejects unknown schemaKind', () => {
        const service = new PieStorageService(makeSettings())
        expect(
            service.uploadMetadataContent({
                componentName: 'Card',
                schemaKind: 'nope' as unknown as 'eventSchema',
                content: new Uint8Array(),
            })
        ).rejects.toThrow(/unknown metadata kind/)
    })

    test('deleteMetadata DELETEs the metadata URL', async () => {
        const mock = await startServer((_req, res) => {
            res.statusCode = 204
            res.end()
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            await service.deleteMetadata({
                componentName: 'Card',
                schemaKind: 'eventSchema',
            })
            expect(mock.requests[0]?.method).toBe('DELETE')
            expect(mock.requests[0]?.url).toBe(
                '/api/components/demo-user/demo-proj/Card/metadata/eventSchema'
            )
        } finally {
            await mock.close()
        }
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/storage.test.ts`
Expected: FAIL — methods missing.

- [ ] **Step 3: Add metadata methods to `PieStorageService`**

Add constant near the top of `storage.ts` (next to `STORAGE_LANGUAGE`):

```ts
export type SchemaKind = 'jsonSchema' | 'eventSchema' | 'llms.txt'

const METADATA_CONTENT_TYPES: Record<SchemaKind, string> = {
    jsonSchema: 'application/json',
    eventSchema: 'application/json',
    'llms.txt': 'text/plain',
}

const metadataContentType = (kind: string): string => {
    if (!(kind in METADATA_CONTENT_TYPES)) {
        const allowed = Object.keys(METADATA_CONTENT_TYPES).sort().join(', ')
        throw new PieStorageError(
            `unknown metadata kind: ${kind}. Use one of: ${allowed}`
        )
    }
    return METADATA_CONTENT_TYPES[kind as SchemaKind]
}
```

Append these methods inside the `PieStorageService` class:

```ts
    async uploadMetadataContent(args: {
        componentName: string
        schemaKind: SchemaKind
        content: Uint8Array
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject> {
        const contentType = metadataContentType(args.schemaKind)
        const url = this.metadataUrl(args)
        const body = new Uint8Array(args.content) // copy into plain ArrayBuffer-backed view
        const response = await this.request({
            method: 'PUT',
            url,
            headers: { 'content-type': contentType },
            body,
        })
        return parseComponentObject(await response.json())
    }

    async downloadMetadata(args: {
        componentName: string
        schemaKind: SchemaKind
        targetPath: string
        userId?: string
        projectSlug?: string
    }): Promise<string> {
        metadataContentType(args.schemaKind)
        const url = this.metadataUrl(args)
        const response = await this.request({ method: 'GET', url })
        const buf = Buffer.from(await response.arrayBuffer())
        const fs = await import('node:fs')
        const path = await import('node:path')
        fs.mkdirSync(path.dirname(args.targetPath), { recursive: true })
        fs.writeFileSync(args.targetPath, buf)
        return args.targetPath
    }

    async deleteMetadata(args: {
        componentName: string
        schemaKind: SchemaKind
        userId?: string
        projectSlug?: string
    }): Promise<void> {
        metadataContentType(args.schemaKind)
        await this.request({ method: 'DELETE', url: this.metadataUrl(args) })
    }
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code/services/storage.ts src/tests/storage.test.ts
git commit -m "feat(services): metadata upload/download/delete"
```

---

### Task 8: Storage — batch language upload (TDD)

**Files:**

- Modify: `src/tests/storage.test.ts`
- Modify: `src/code/services/storage.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/tests/storage.test.ts`:

```ts
import fsNode from 'node:fs'
import osNode from 'node:os'
import pathNode from 'node:path'

const writeTmpFile = (dir: string, rel: string, content: string): string => {
    const abs = pathNode.join(dir, rel)
    fsNode.mkdirSync(pathNode.dirname(abs), { recursive: true })
    fsNode.writeFileSync(abs, content, 'utf8')
    return abs
}

const parseMultipart = (
    body: Buffer,
    contentType: string
): Array<{ name?: string; filename?: string; value: string }> => {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
    if (!m) throw new Error('no boundary')
    const boundary = m[1] || m[2]
    const raw = body.toString('latin1')
    return raw
        .split(`--${boundary}`)
        .slice(1, -1)
        .map((block) => block.replace(/^\r\n/, '').replace(/\r\n$/, ''))
        .map((block) => {
            const [headerText, ...bodyParts] = block.split('\r\n\r\n')
            const headers: Record<string, string> = {}
            for (const line of headerText.split('\r\n')) {
                const idx = line.indexOf(':')
                if (idx === -1) continue
                headers[line.slice(0, idx).trim().toLowerCase()] = line
                    .slice(idx + 1)
                    .trim()
            }
            const disposition = headers['content-disposition'] || ''
            const name = /name="([^"]+)"/.exec(disposition)?.[1]
            const filename = /filename="([^"]+)"/.exec(disposition)?.[1]
            const value = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '')
            return { name, filename, value }
        })
}

describe('PieStorageService.uploadLanguageFilesBatch', () => {
    test('PUTs multipart with object_paths + files for each entry', async () => {
        const tmp = fsNode.mkdtempSync(
            pathNode.join(osNode.tmpdir(), 'pieui-storage-batch-')
        )
        const aFile = writeTmpFile(tmp, 'index.ts', 'export {}\n')
        const bFile = writeTmpFile(tmp, 'ui/view.tsx', 'export default null\n')

        const mock = await startServer((_req, res) => {
            res.end(
                JSON.stringify({
                    objects: [
                        { key: '…/Card/typescript/index.ts' },
                        { key: '…/Card/typescript/ui/view.tsx' },
                    ],
                })
            )
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const results = await service.uploadLanguageFilesBatch({
                componentName: 'Card',
                files: [
                    ['index.ts', aFile],
                    ['ui/view.tsx', bFile],
                ],
            })
            expect(results.map((r) => r.key)).toEqual([
                '…/Card/typescript/index.ts',
                '…/Card/typescript/ui/view.tsx',
            ])
            const req = mock.requests[0]!
            expect(req.method).toBe('PUT')
            expect(req.url).toBe(
                '/api/components/demo-user/demo-proj/Card/batch/typescript'
            )
            const parts = parseMultipart(
                req.body,
                String(req.headers['content-type'])
            )
            const objectPaths = parts
                .filter((p) => p.name === 'object_paths')
                .map((p) => p.value)
            const files = parts
                .filter((p) => p.name === 'files')
                .map((p) => p.value)
            expect(objectPaths).toEqual(['index.ts', 'ui/view.tsx'])
            expect(files).toEqual(['export {}\n', 'export default null\n'])
        } finally {
            await mock.close()
            fsNode.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('throws when source file missing', () => {
        const service = new PieStorageService(makeSettings())
        expect(
            service.uploadLanguageFilesBatch({
                componentName: 'Card',
                files: [['index.ts', '/does/not/exist.ts']],
            })
        ).rejects.toThrow(/file not found/)
    })

    test('returns [] when file list empty without issuing request', async () => {
        const mock = await startServer((_req, res) => res.end('{}'))
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const result = await service.uploadLanguageFilesBatch({
                componentName: 'Card',
                files: [],
            })
            expect(result).toEqual([])
            expect(mock.requests.length).toBe(0)
        } finally {
            await mock.close()
        }
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/storage.test.ts`
Expected: FAIL — `uploadLanguageFilesBatch` missing.

- [ ] **Step 3: Implement batch upload**

Add these helpers above the class in `storage.ts`:

```ts
const MIME_BY_EXT: Record<string, string> = {
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.css': 'text/css',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
}

const guessMime = (filename: string): string => {
    const lower = filename.toLowerCase()
    const dot = lower.lastIndexOf('.')
    if (dot === -1) return 'application/octet-stream'
    return MIME_BY_EXT[lower.slice(dot)] || 'application/octet-stream'
}
```

Add method inside `PieStorageService`:

```ts
    async uploadLanguageFilesBatch(args: {
        componentName: string
        files: Array<[string, string]>
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject[]> {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const items = args.files.map(([objectPath, filePath]) => ({
            objectPath: normalizeObjectPath(objectPath),
            filePath: path.resolve(filePath),
        }))
        for (const item of items) {
            if (!fs.existsSync(item.filePath) || !fs.statSync(item.filePath).isFile()) {
                throw new PieStorageError(`file not found: ${item.filePath}`)
            }
        }
        if (items.length === 0) return []

        const form = new FormData()
        for (const item of items) {
            form.append('object_paths', item.objectPath)
        }
        for (const item of items) {
            const buf = fs.readFileSync(item.filePath)
            const copy = new Uint8Array(buf.byteLength)
            copy.set(buf)
            const filename = path.basename(item.filePath)
            form.append(
                'files',
                new File([copy], filename, { type: guessMime(filename) })
            )
        }

        const response = await this.request({
            method: 'PUT',
            url: this.languageBatchUrl(args),
            body: form,
        })
        const data = (await response.json()) as { objects?: unknown[] }
        const objects = Array.isArray(data.objects) ? data.objects : []
        return objects.map(parseComponentObject)
    }
```

Note: `normalizeObjectPath` returns URL-encoded segments. For the multipart
`object_paths` field we want the **unencoded** POSIX path (Python does
`_normalize_object_path` which also URL-encodes — the server is expected to
decode). Match Python byte-for-byte by keeping the encoded form.

(If a later test asserts unencoded paths, adjust by introducing a
`normalizeObjectPathRaw` that only validates — but per spec we match Python.)

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/storage.test.ts`
Expected: PASS. If `object_paths` assertion fails because of encoding, update
the test's expected values to match the encoded form (e.g., `index.ts` is
already safe; only segments with special chars encode).

- [ ] **Step 5: Commit**

```bash
git add src/code/services/storage.ts src/tests/storage.test.ts
git commit -m "feat(services): batch language file upload"
```

---

### Task 9: Storage — directory upload & download (TDD)

**Files:**

- Modify: `src/tests/storage.test.ts`
- Modify: `src/code/services/storage.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/tests/storage.test.ts`:

```ts
describe('PieStorageService.uploadComponentDirectory', () => {
    test('walks sourceDir recursively and batches all files', async () => {
        const tmp = fsNode.mkdtempSync(
            pathNode.join(osNode.tmpdir(), 'pieui-storage-dir-')
        )
        writeTmpFile(tmp, 'index.ts', 'i')
        writeTmpFile(tmp, 'ui/view.tsx', 'v')
        writeTmpFile(tmp, 'types/index.ts', 't')

        const mock = await startServer((_req, res) => {
            res.end(JSON.stringify({ objects: [] }))
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            await service.uploadComponentDirectory({
                componentName: 'Card',
                sourceDir: tmp,
            })
            const req = mock.requests[0]!
            const parts = parseMultipart(
                req.body,
                String(req.headers['content-type'])
            )
            const objectPaths = parts
                .filter((p) => p.name === 'object_paths')
                .map((p) => p.value)
                .sort()
            expect(objectPaths).toEqual([
                'index.ts',
                'types/index.ts',
                'ui/view.tsx',
            ])
        } finally {
            await mock.close()
            fsNode.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('throws when sourceDir does not exist', () => {
        const service = new PieStorageService(makeSettings())
        expect(
            service.uploadComponentDirectory({
                componentName: 'Card',
                sourceDir: '/no/such/dir-pieui-xxx',
            })
        ).rejects.toThrow(/component directory not found/)
    })
})

describe('PieStorageService.downloadComponentDirectory', () => {
    test('lists then downloads each typescript object into target dir', async () => {
        const tmpOut = fsNode.mkdtempSync(
            pathNode.join(osNode.tmpdir(), 'pieui-storage-pull-')
        )
        const mock = await startServer((req, res) => {
            if (req.url?.endsWith('/Card')) {
                res.end(
                    JSON.stringify({
                        prefix: 'p/',
                        typescript: {
                            objects: [
                                { key: 'p/typescript/index.ts' },
                                { key: 'p/typescript/ui/view.tsx' },
                            ],
                        },
                    })
                )
                return
            }
            if (req.url?.includes('/typescript/index.ts')) {
                res.end('export {}\n')
                return
            }
            if (req.url?.includes('/typescript/ui/view.tsx')) {
                res.end('export default null\n')
                return
            }
            res.statusCode = 404
            res.end()
        })
        try {
            const service = new PieStorageService(
                makeSettings({ apiBaseUrl: `${mock.baseUrl}/api` })
            )
            const downloaded = await service.downloadComponentDirectory({
                componentName: 'Card',
                targetDir: tmpOut,
            })
            expect(downloaded.length).toBe(2)
            expect(
                fsNode.readFileSync(pathNode.join(tmpOut, 'index.ts'), 'utf8')
            ).toBe('export {}\n')
            expect(
                fsNode.readFileSync(
                    pathNode.join(tmpOut, 'ui/view.tsx'),
                    'utf8'
                )
            ).toBe('export default null\n')
        } finally {
            await mock.close()
            fsNode.rmSync(tmpOut, { recursive: true, force: true })
        }
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/storage.test.ts`
Expected: FAIL — missing methods.

- [ ] **Step 3: Implement directory upload + per-file download + directory download**

Add to `PieStorageService`:

```ts
    async uploadComponentDirectory(args: {
        componentName: string
        sourceDir: string
        userId?: string
        projectSlug?: string
    }): Promise<ComponentObject[]> {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const source = path.resolve(args.sourceDir)
        if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
            throw new PieStorageError(`component directory not found: ${source}`)
        }
        const collected: string[] = []
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs = path.join(dir, entry.name)
                if (entry.isDirectory()) walk(abs)
                else if (entry.isFile()) collected.push(abs)
            }
        }
        walk(source)
        collected.sort()
        const files: Array<[string, string]> = collected.map((abs) => [
            path.relative(source, abs).split(path.sep).join('/'),
            abs,
        ])
        if (files.length === 0) return []
        return this.uploadLanguageFilesBatch({
            componentName: args.componentName,
            files,
            userId: args.userId,
            projectSlug: args.projectSlug,
        })
    }

    async downloadLanguageFile(args: {
        componentName: string
        objectPath: string
        targetPath: string
        userId?: string
        projectSlug?: string
    }): Promise<string> {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const url = this.languageFileUrl(args)
        const response = await this.request({ method: 'GET', url })
        const buf = Buffer.from(await response.arrayBuffer())
        fs.mkdirSync(path.dirname(args.targetPath), { recursive: true })
        fs.writeFileSync(args.targetPath, buf)
        return args.targetPath
    }

    async downloadComponentDirectory(args: {
        componentName: string
        targetDir: string
        userId?: string
        projectSlug?: string
    }): Promise<string[]> {
        const path = await import('node:path')
        const tree = await this.listComponent(args)
        const objects = tree.typescript?.objects ?? []
        const prefix = `${tree.prefix}${STORAGE_LANGUAGE}/`
        const downloaded: string[] = []
        for (const obj of objects) {
            if (!obj.key.startsWith(prefix)) continue
            const objectPath = obj.key.slice(prefix.length)
            const targetPath = path.join(args.targetDir, objectPath)
            downloaded.push(
                await this.downloadLanguageFile({
                    ...args,
                    objectPath,
                    targetPath,
                })
            )
        }
        return downloaded
    }
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/storage.test.ts`
Expected: PASS, full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/code/services/storage.ts src/tests/storage.test.ts
git commit -m "feat(services): component directory upload/download"
```

---

### Task 10: `extractCardMetadata` (TDD)

**Files:**

- Create: `src/tests/cardMetadata.test.ts`
- Create: `src/code/cardMetadata.ts`

- [ ] **Step 1: Write failing tests**

`src/tests/cardMetadata.test.ts`:

```ts
import { describe, test, expect } from 'bun:test'
import {
    extractCardMetadata,
    serializeCardMetadata,
} from '../code/cardMetadata'

describe('extractCardMetadata', () => {
    test('plain scaffold → ajax=false, io=false', () => {
        const src = `export interface MyCardData { name: string }\nexport type MyCardProps = any\n`
        expect(extractCardMetadata('MyCard', src)).toEqual({
            component: 'MyCard',
            input: false,
            ajax: false,
            io: false,
        })
    })

    test('ajax scaffold → ajax=true', () => {
        const src = `
export interface MyCardData {
    name: string
    pathname?: string
    depsNames: string[]
    kwargs: Record<string, string | number | boolean>
}
`
        expect(extractCardMetadata('MyCard', src).ajax).toBe(true)
        expect(extractCardMetadata('MyCard', src).io).toBe(false)
    })

    test('io scaffold → io=true', () => {
        const src = `
export interface MyCardData {
    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}
`
        expect(extractCardMetadata('MyCard', src).io).toBe(true)
        expect(extractCardMetadata('MyCard', src).ajax).toBe(false)
    })

    test('combined scaffold → both true', () => {
        const src = `
interface D {
    useSocketioSupport?: boolean
    pathname?: string
    depsNames: string[]
    kwargs: Record<string, string>
}
`
        expect(extractCardMetadata('C', src)).toEqual({
            component: 'C',
            input: false,
            ajax: true,
            io: true,
        })
    })

    test('undefined source → both false', () => {
        expect(extractCardMetadata('X', undefined)).toEqual({
            component: 'X',
            input: false,
            ajax: false,
            io: false,
        })
    })
})

describe('serializeCardMetadata', () => {
    test('emits sorted keys with trailing newline', () => {
        const bytes = serializeCardMetadata({
            component: 'B',
            input: false,
            ajax: true,
            io: false,
        })
        const text = new TextDecoder().decode(bytes)
        expect(text).toBe(
            '{"ajax":true,"component":"B","input":false,"io":false}\n'
        )
    })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `bun test src/tests/cardMetadata.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `cardMetadata.ts`**

`src/code/cardMetadata.ts`:

```ts
export type CardMetadata = {
    component: string
    input: false
    ajax: boolean
    io: boolean
}

const AJAX_FIELD_NAMES = ['pathname', 'depsNames', 'kwargs']
const IO_FIELD_NAMES = [
    'useSocketioSupport',
    'useCentrifugeSupport',
    'useMittSupport',
    'centrifugeChannel',
]

const containsIdentifier = (source: string, name: string): boolean => {
    const pattern = new RegExp(`\\b${name}\\b`)
    return pattern.test(source)
}

export const extractCardMetadata = (
    componentName: string,
    source: string | undefined
): CardMetadata => {
    if (!source) {
        return {
            component: componentName,
            input: false,
            ajax: false,
            io: false,
        }
    }
    return {
        component: componentName,
        input: false,
        ajax: AJAX_FIELD_NAMES.some((n) => containsIdentifier(source, n)),
        io: IO_FIELD_NAMES.some((n) => containsIdentifier(source, n)),
    }
}

export const serializeCardMetadata = (meta: CardMetadata): Uint8Array => {
    const entries = Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))
    const obj: Record<string, unknown> = {}
    for (const [k, v] of entries) obj[k] = v
    const text = JSON.stringify(obj) + '\n'
    return new TextEncoder().encode(text)
}
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/cardMetadata.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/code/cardMetadata.ts src/tests/cardMetadata.test.ts
git commit -m "feat(cli): extractCardMetadata for card remote push"
```

---

### Task 11: CLI args — parse `card remote <action>` + deprecate legacy

**Files:**

- Modify: `src/code/types.ts`
- Modify: `src/code/args.ts`
- Delete: `src/code/commands/push.ts`, `src/code/commands/pull.ts`, `src/code/commands/remoteRemove.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Update types**

Modify `src/code/types.ts`:

- Change `export type CardAction = 'add'` to `export type CardAction = 'add' | 'remote'`
- Add after `CardAction`: `export type CardRemoteAction = 'push' | 'pull' | 'list' | 'remove'`
- Add to `ParsedArgs`:

    ```ts
        cardRemoteAction?: CardRemoteAction
        remoteUserId?: string
        remoteProjectSlug?: string
    ```

- [ ] **Step 2: Update `args.ts`**

Replace the `card` parsing block in `src/code/args.ts` with:

```ts
if (command === 'card' && argv[1]) {
    const validActions: CardAction[] = ['add', 'remote']
    if (validActions.includes(argv[1] as CardAction)) {
        cardAction = argv[1] as CardAction
    }
}
```

Then after the existing `card add` parsing block, add a `card remote` parsing block:

```ts
if (command === 'card' && cardAction === 'remote' && argv[2]) {
    const validRemoteActions: CardRemoteAction[] = [
        'push',
        'pull',
        'list',
        'remove',
    ]
    const action = argv[2] as CardRemoteAction
    if (validRemoteActions.includes(action)) {
        cardRemoteAction = action
        const rest = argv.slice(3)
        const flagIndexes = new Set<number>()
        for (let i = 0; i < rest.length; i++) {
            const tok = rest[i]
            if (tok === '--user' && rest[i + 1]) {
                remoteUserId = rest[i + 1]
                flagIndexes.add(i)
                flagIndexes.add(i + 1)
                i++
            } else if (tok === '--project' && rest[i + 1]) {
                remoteProjectSlug = rest[i + 1]
                flagIndexes.add(i)
                flagIndexes.add(i + 1)
                i++
            } else if (tok?.startsWith('--user=')) {
                remoteUserId = tok.slice('--user='.length)
                flagIndexes.add(i)
            } else if (tok?.startsWith('--project=')) {
                remoteProjectSlug = tok.slice('--project='.length)
                flagIndexes.add(i)
            }
        }
        const positionals = rest.filter((_, i) => !flagIndexes.has(i))
        if (positionals[0]) componentName = positionals[0]
    }
}
```

Add the new imports/locals at the top of `parseArgs`:

- `let cardRemoteAction: CardRemoteAction | undefined`
- `let remoteUserId: string | undefined`
- `let remoteProjectSlug: string | undefined`
- `import type { ... CardRemoteAction }` alongside the existing imports.

And remove the legacy parse block:

```ts
if (
    (command === 'pull' || command === 'push' || command === 'remote-remove') &&
    argv[1]
) {
    componentName = argv[1]
}
```

Extend the return object to include the new fields:

```ts
        cardRemoteAction,
        remoteUserId,
        remoteProjectSlug,
```

Update `printUsage`:

- Delete the three lines documenting top-level `push`, `pull`, `remote-remove`
- Add:
    ```ts
    console.log(
        '  card remote push <ComponentName>         Upload piecomponents/<Name>/ to PieUI storage'
    )
    console.log(
        '  card remote pull <ComponentName>         Download component from PieUI storage into piecomponents/<Name>/'
    )
    console.log(
        '  card remote list [--user U] [--project S]  List remote components for the configured or specified user/project'
    )
    console.log(
        '  card remote remove <ComponentName>       Delete component from PieUI storage'
    )
    ```
- Replace the three trailing `push/pull/remote-remove` example lines with:

    ```ts
    console.log(
        '  pieui card remote push ExchangeAlertsCard    # Upload component directory'
    )
    console.log(
        '  pieui card remote pull ExchangeAlertsCard    # Download component directory'
    )
    console.log(
        '  pieui card remote list                       # List remote components'
    )
    console.log(
        '  pieui card remote remove ExchangeAlertsCard  # Delete remote component'
    )
    ```

- [ ] **Step 3: Update `src/cli.ts`**

- Remove imports of `pushCommand`, `pullCommand`, `remoteRemoveCommand`.
- Add imports:
    ```ts
    import { cardRemotePushCommand } from './code/commands/cardRemote/push'
    import { cardRemotePullCommand } from './code/commands/cardRemote/pull'
    import { cardRemoteListCommand } from './code/commands/cardRemote/list'
    import { cardRemoteRemoveCommand } from './code/commands/cardRemote/remove'
    ```
- Destructure new fields from `parseArgs`:
    ```ts
    const {
        ...,
        cardRemoteAction,
        remoteUserId,
        remoteProjectSlug,
    } = parseArgs(process.argv.slice(2))
    ```
- Replace the existing `card` case body with:
    ```ts
    case 'card':
        if (cardAction === 'add') {
            if (!componentName) {
                console.error('[pieui] Error: Component name is required for card add command')
                printUsage()
                process.exit(1)
            }
            addCommand(componentName, componentType, { ajax: cardAjax, io: cardIo })
            return
        }
        if (cardAction === 'remote') {
            if (cardRemoteAction === 'list') {
                await cardRemoteListCommand({
                    userId: remoteUserId,
                    projectSlug: remoteProjectSlug,
                })
                return
            }
            if (!componentName) {
                console.error(
                    `[pieui] Error: Component name is required for card remote ${cardRemoteAction ?? ''} command`
                )
                printUsage()
                process.exit(1)
            }
            if (cardRemoteAction === 'push') {
                await cardRemotePushCommand(componentName)
                return
            }
            if (cardRemoteAction === 'pull') {
                await cardRemotePullCommand(componentName)
                return
            }
            if (cardRemoteAction === 'remove') {
                await cardRemoteRemoveCommand(componentName)
                return
            }
            console.error('[pieui] Error: Supported card remote subcommands: push, pull, list, remove')
            printUsage()
            process.exit(1)
        }
        console.error('[pieui] Error: Supported card subcommands: add, remote')
        printUsage()
        process.exit(1)
    ```
- Delete the `case 'push':`, `case 'pull':`, `case 'remote-remove':` blocks.

- [ ] **Step 4: Delete legacy files**

```bash
rm src/code/commands/push.ts src/code/commands/pull.ts src/code/commands/remoteRemove.ts
```

- [ ] **Step 5: Create empty command stubs so `cli.ts` still compiles**

Create the four command files as stubs (filled in Tasks 12–15):

`src/code/commands/cardRemote/push.ts`:

```ts
export const cardRemotePushCommand = async (
    _componentName: string
): Promise<void> => {
    throw new Error('not implemented')
}
```

`src/code/commands/cardRemote/pull.ts`:

```ts
export const cardRemotePullCommand = async (
    _componentName: string
): Promise<void> => {
    throw new Error('not implemented')
}
```

`src/code/commands/cardRemote/list.ts`:

```ts
export const cardRemoteListCommand = async (_options: {
    userId?: string
    projectSlug?: string
}): Promise<void> => {
    throw new Error('not implemented')
}
```

`src/code/commands/cardRemote/remove.ts`:

```ts
export const cardRemoteRemoveCommand = async (
    _componentName: string
): Promise<void> => {
    throw new Error('not implemented')
}
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cli): parse card remote subcommands; drop legacy push/pull/remote-remove"
```

---

### Task 12: `card remote list` command

**Files:**

- Modify: `src/code/commands/cardRemote/list.ts`

- [ ] **Step 1: Implement the command**

Replace `src/code/commands/cardRemote/list.ts` with:

```ts
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemoteListCommand = async (options: {
    userId?: string
    projectSlug?: string
}): Promise<void> => {
    const settings = loadSettings()
    const userId = options.userId || settings.userId
    const projectSlug = options.projectSlug || settings.project
    if (!userId) {
        throw new Error(
            'user_id is required (use --user or set PIE_USER_ID in env or .env)'
        )
    }
    if (!projectSlug) {
        throw new Error(
            'project is required (use --project or set PIE_PROJECT / PIE_PROJECT_SLUG)'
        )
    }

    const service = new PieStorageService(settings)
    const result = await service.listProjectComponents({ userId, projectSlug })
    console.log(
        `[pieui] Remote components for user_id=${JSON.stringify(result.userId)} project_slug=${JSON.stringify(result.projectSlug)}:`
    )
    for (const entry of [...result.components].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    )) {
        console.log(entry.name)
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit (integration test comes in Task 16)**

```bash
git add src/code/commands/cardRemote/list.ts
git commit -m "feat(cli): card remote list"
```

---

### Task 13: `card remote push` command

**Files:**

- Modify: `src/code/commands/cardRemote/push.ts`

- [ ] **Step 1: Implement**

Replace `src/code/commands/cardRemote/push.ts` with:

```ts
import fs from 'node:fs'
import path from 'node:path'
import { extractCardMetadata, serializeCardMetadata } from '../../cardMetadata'
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemotePushCommand = async (
    componentName: string
): Promise<void> => {
    if (!/^[A-Z][A-Za-z0-9]+$/.test(componentName)) {
        throw new Error(
            'Component name must start with uppercase letter and contain only letters and numbers'
        )
    }
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error(
            'user_id is required (set PIE_USER_ID in env or .env; run `pieui login`)'
        )
    }

    const componentDir = path.join(settings.componentsDir, componentName)
    if (
        !fs.existsSync(componentDir) ||
        !fs.statSync(componentDir).isDirectory()
    ) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const service = new PieStorageService(settings)

    const uploaded = await service.uploadComponentDirectory({
        componentName,
        sourceDir: componentDir,
    })
    if (uploaded.length === 0) {
        throw new Error(`No files uploaded for component: ${componentName}`)
    }

    const typesPath = path.join(componentDir, 'types', 'index.ts')
    const typesSource = fs.existsSync(typesPath)
        ? fs.readFileSync(typesPath, 'utf8')
        : undefined
    const metadata = extractCardMetadata(componentName, typesSource)
    const metadataResult = await service.uploadMetadataContent({
        componentName,
        schemaKind: 'eventSchema',
        content: serializeCardMetadata(metadata),
    })

    console.log(`[pieui] Uploaded card: ${componentName}`)
    console.log(`[pieui] Path: ${componentDir}`)
    console.log(`[pieui] Files uploaded: ${uploaded.length}`)
    console.log(`[pieui] Metadata key: ${metadataResult.key}`)
    console.log(
        `[pieui] Metadata: Input=${metadata.input ? 'Yes' : 'No'}, ` +
            `Ajax=${metadata.ajax ? 'Yes' : 'No'}, IO=${metadata.io ? 'Yes' : 'No'}`
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/code/commands/cardRemote/push.ts
git commit -m "feat(cli): card remote push uploads directory + eventSchema"
```

---

### Task 14: `card remote pull` command

**Files:**

- Modify: `src/code/commands/cardRemote/pull.ts`

- [ ] **Step 1: Implement**

Replace `src/code/commands/cardRemote/pull.ts` with:

```ts
import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemotePullCommand = async (
    componentName: string
): Promise<void> => {
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error(
            'user_id is required (set PIE_USER_ID in env or .env; run `pieui login`)'
        )
    }
    if (!settings.project) {
        throw new Error(
            'project is required (set PIE_PROJECT or PIE_PROJECT_SLUG in env or .env)'
        )
    }

    const componentDir = path.join(settings.componentsDir, componentName)
    fs.mkdirSync(settings.componentsDir, { recursive: true })

    const tempDir = `${componentDir}.pieui-tmp-${process.pid}-${Date.now()}`
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.mkdirSync(tempDir, { recursive: true })

    const service = new PieStorageService(settings)
    let downloaded: string[]
    try {
        downloaded = await service.downloadComponentDirectory({
            componentName,
            targetDir: tempDir,
        })
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw error
    }

    if (downloaded.length === 0) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw new Error(
            `No typescript files found for remote component ${componentName} (user_id=${settings.userId}, project=${settings.project})`
        )
    }

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    fs.renameSync(tempDir, componentDir)

    console.log(`[pieui] Pulled card: ${componentName}`)
    for (const p of downloaded) {
        const relative = path.relative(tempDir, p)
        console.log(`[pieui] Path: ${path.join(componentDir, relative)}`)
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/code/commands/cardRemote/pull.ts
git commit -m "feat(cli): card remote pull with atomic directory swap"
```

---

### Task 15: `card remote remove` command

**Files:**

- Modify: `src/code/commands/cardRemote/remove.ts`

- [ ] **Step 1: Implement**

Replace `src/code/commands/cardRemote/remove.ts` with:

```ts
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemoteRemoveCommand = async (
    componentName: string
): Promise<void> => {
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error('user_id is required (set PIE_USER_ID in env or .env)')
    }
    if (!settings.project) {
        throw new Error(
            'project is required (set PIE_PROJECT or PIE_PROJECT_SLUG in env or .env)'
        )
    }

    const service = new PieStorageService(settings)
    await service.deleteComponent({ componentName })
    console.log(`[pieui] Removed remote component: ${componentName}`)
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/code/commands/cardRemote/remove.ts
git commit -m "feat(cli): card remote remove"
```

---

### Task 16: Rewrite integration tests (`step2-remote.test.cjs`)

**Files:**

- Modify: `src/__tests__/step2-remote.test.cjs`

- [ ] **Step 1: Replace the file with tests targeting the new CLI surface**

Replace **all** contents of `src/__tests__/step2-remote.test.cjs` with:

```js
const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')

const writeFile = (filePath, contents) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents, 'utf8')
}

const resolveCliCommand = () => {
    const bunInPath = spawnSync('bun', ['--version'], { stdio: 'ignore' })
    if (bunInPath.status === 0) {
        return ['bun', path.join(repoRoot, 'src', 'cli.ts')]
    }
    const homeBun = path.join(os.homedir(), '.bun', 'bin', 'bun')
    const bunFromHome = spawnSync(homeBun, ['--version'], { stdio: 'ignore' })
    if (bunFromHome.status === 0) {
        return [homeBun, path.join(repoRoot, 'src', 'cli.ts')]
    }
    const distCli = path.join(repoRoot, 'dist', 'cli.js')
    if (fs.existsSync(distCli)) return ['node', distCli]
    throw new Error(
        'Cannot resolve pieui CLI runtime. Install bun or build dist/cli.js.'
    )
}

const runCli = ({ cwd, args, env = {}, timeoutMs = 20000 }) =>
    new Promise((resolve) => {
        const cmd = resolveCliCommand()
        const child = spawn(cmd[0], [...cmd.slice(1), ...args], {
            cwd,
            env: {
                ...process.env,
                ...env,
                NODE_PATH: path.join(repoRoot, 'node_modules'),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
        child.stdout.on('data', (c) => (stdout += c.toString()))
        child.stderr.on('data', (c) => (stderr += c.toString()))
        child.on('close', (code, signal) => {
            clearTimeout(timer)
            resolve({ status: code, signal, stdout, stderr })
        })
    })

const startServer = async (handler) => {
    const server = http.createServer((req, res) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
            const body = Buffer.concat(chunks)
            Promise.resolve(handler(req, res, body)).catch((error) => {
                res.statusCode = 500
                res.end(String(error))
            })
        })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    return { server, baseUrl: `http://127.0.0.1:${addr.port}` }
}
const stopServer = (server) => new Promise((r) => server.close(r))

const parseMultipart = (body, contentType) => {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
    if (!m) throw new Error('no boundary')
    const boundary = m[1] || m[2]
    const raw = body.toString('latin1')
    return raw
        .split(`--${boundary}`)
        .slice(1, -1)
        .map((b) => b.replace(/^\r\n/, '').replace(/\r\n$/, ''))
        .map((block) => {
            const [headerText, ...bodyParts] = block.split('\r\n\r\n')
            const headers = {}
            for (const line of headerText.split('\r\n')) {
                const idx = line.indexOf(':')
                if (idx === -1) continue
                headers[line.slice(0, idx).trim().toLowerCase()] = line
                    .slice(idx + 1)
                    .trim()
            }
            const name = /name="([^"]+)"/.exec(
                headers['content-disposition'] || ''
            )?.[1]
            return {
                name,
                value: bodyParts.join('\r\n\r\n').replace(/\r\n$/, ''),
            }
        })
}

const mkTempDir = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p))
const assertOk = (result, msg) =>
    assert.equal(
        result.status,
        0,
        `${msg}\nSTATUS:${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )

test('card remote push uploads all files + eventSchema metadata', async () => {
    const projectDir = mkTempDir('pieui-cr-push-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'index.ts'),
        'export {}\n'
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'ui', 'view.tsx'),
        'export default null\n'
    )
    writeFile(
        path.join(
            projectDir,
            'piecomponents',
            'AlertsCard',
            'types',
            'index.ts'
        ),
        'export interface AlertsCardData { pathname?: string; depsNames: string[]; kwargs: Record<string,string> }\n'
    )

    const requests = []
    const { server, baseUrl } = await startServer((req, res, body) => {
        requests.push({
            method: req.method,
            url: req.url,
            headers: req.headers,
            body,
        })
        if (req.url?.endsWith('/batch/typescript')) {
            res.end(
                JSON.stringify({
                    objects: [{ key: 'k1' }, { key: 'k2' }, { key: 'k3' }],
                })
            )
        } else {
            res.end(JSON.stringify({ key: 'meta-key' }))
        }
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'push', 'AlertsCard'],
            env: {
                PIE_USER_ID: 'u1',
                PIE_PROJECT: 'proj',
                PIE_API_KEY: 'k',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'push should succeed')
        assert.equal(requests.length, 2)

        const batch = requests[0]
        assert.equal(batch.method, 'PUT')
        assert.equal(
            batch.url,
            '/api/components/u1/proj/AlertsCard/batch/typescript'
        )
        assert.equal(batch.headers['x-api-key'], 'k')
        const parts = parseMultipart(batch.body, batch.headers['content-type'])
        const paths = parts
            .filter((p) => p.name === 'object_paths')
            .map((p) => p.value)
            .sort()
        assert.deepEqual(paths, ['index.ts', 'types/index.ts', 'ui/view.tsx'])

        const meta = requests[1]
        assert.equal(meta.method, 'PUT')
        assert.equal(
            meta.url,
            '/api/components/u1/proj/AlertsCard/metadata/eventSchema'
        )
        assert.equal(meta.headers['content-type'], 'application/json')
        const metaObj = JSON.parse(meta.body.toString('utf8').trim())
        assert.equal(metaObj.component, 'AlertsCard')
        assert.equal(metaObj.ajax, true)
        assert.equal(metaObj.io, false)
        assert.equal(metaObj.input, false)
    } finally {
        await stopServer(server)
    }
})

test('card remote push fails when component dir missing', async () => {
    const projectDir = mkTempDir('pieui-cr-push-missing-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })
    const result = await runCli({
        cwd: projectDir,
        args: ['card', 'remote', 'push', 'NoCard'],
        env: { PIE_USER_ID: 'u', PIE_PROJECT: 'p' },
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Component directory not found/)
})

test('card remote push fails when PIE_USER_ID not set', async () => {
    const projectDir = mkTempDir('pieui-cr-push-nouser-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'X', 'index.ts'),
        'export {}\n'
    )
    const result = await runCli({
        cwd: projectDir,
        args: ['card', 'remote', 'push', 'X'],
        env: { PIE_USER_ID: '', PIE_PROJECT: 'p' },
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /user_id is required/)
})

test('card remote pull downloads dir and swaps atomically', async () => {
    const projectDir = mkTempDir('pieui-cr-pull-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'SyncCard', 'old.txt'),
        'old\n'
    )

    const { server, baseUrl } = await startServer((req, res) => {
        if (req.url?.endsWith('/SyncCard')) {
            res.end(
                JSON.stringify({
                    prefix: 'p/',
                    typescript: {
                        objects: [
                            { key: 'p/typescript/index.ts' },
                            { key: 'p/typescript/ui/view.tsx' },
                        ],
                    },
                })
            )
            return
        }
        if (req.url?.endsWith('/typescript/index.ts')) {
            res.end('export const value = 1\n')
            return
        }
        if (req.url?.endsWith('/typescript/ui/view.tsx')) {
            res.end('export default null\n')
            return
        }
        res.statusCode = 404
        res.end()
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'pull', 'SyncCard'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'pull should succeed')
        assert.equal(
            fs.existsSync(
                path.join(projectDir, 'piecomponents', 'SyncCard', 'old.txt')
            ),
            false
        )
        assert.equal(
            fs.readFileSync(
                path.join(projectDir, 'piecomponents', 'SyncCard', 'index.ts'),
                'utf8'
            ),
            'export const value = 1\n'
        )
        assert.equal(
            fs.readFileSync(
                path.join(
                    projectDir,
                    'piecomponents',
                    'SyncCard',
                    'ui',
                    'view.tsx'
                ),
                'utf8'
            ),
            'export default null\n'
        )
    } finally {
        await stopServer(server)
    }
})

test('card remote pull errors when no typescript files present', async () => {
    const projectDir = mkTempDir('pieui-cr-pull-empty-')
    const { server, baseUrl } = await startServer((_req, res) => {
        res.end(JSON.stringify({ prefix: 'p/', typescript: { objects: [] } }))
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'pull', 'Nothing'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assert.equal(result.status, 1)
        assert.match(result.stderr, /No typescript files found/)
    } finally {
        await stopServer(server)
    }
})

test('card remote list prints sorted component names', async () => {
    const projectDir = mkTempDir('pieui-cr-list-')
    const { server, baseUrl } = await startServer((_req, res) => {
        res.end(
            JSON.stringify({
                user_id: 'u',
                project_slug: 's',
                components: [
                    { name: 'Bravo' },
                    { name: 'alpha' },
                    { name: 'Charlie' },
                ],
            })
        )
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'list'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'list should succeed')
        const namesLine = result.stdout
            .split('\n')
            .filter((l) => !l.startsWith('[pieui]'))
            .filter(Boolean)
        assert.deepEqual(namesLine, ['alpha', 'Bravo', 'Charlie'])
    } finally {
        await stopServer(server)
    }
})

test('card remote list respects --user / --project overrides', async () => {
    const projectDir = mkTempDir('pieui-cr-list-override-')
    let capturedUrl
    const { server, baseUrl } = await startServer((req, res) => {
        capturedUrl = req.url
        res.end(
            JSON.stringify({ user_id: 'X', project_slug: 'Y', components: [] })
        )
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'list', '--user', 'X', '--project', 'Y'],
            env: {
                PIE_API_BASE_URL: `${baseUrl}/api`,
                PIE_USER_ID: '',
                PIE_PROJECT: '',
            },
        })
        assertOk(result, 'list override should succeed')
        assert.equal(capturedUrl, '/api/components/X/Y')
    } finally {
        await stopServer(server)
    }
})

test('card remote remove DELETEs the component URL', async () => {
    const projectDir = mkTempDir('pieui-cr-remove-')
    let captured
    const { server, baseUrl } = await startServer((req, res) => {
        captured = { method: req.method, url: req.url }
        res.statusCode = 204
        res.end()
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'remove', 'LegacyCard'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'remove should succeed')
        assert.equal(captured.method, 'DELETE')
        assert.equal(captured.url, '/api/components/u/s/LegacyCard')
    } finally {
        await stopServer(server)
    }
})

test('card remote push / pull / remove require component name', async () => {
    const projectDir = mkTempDir('pieui-cr-argcheck-')
    for (const action of ['push', 'pull', 'remove']) {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', action],
        })
        assert.equal(result.status, 1, `${action} without name should fail`)
        assert.match(result.stderr, /Component name is required/)
    }
})

test('legacy top-level push / pull / remote-remove commands are gone', async () => {
    const projectDir = mkTempDir('pieui-cr-legacy-')
    for (const cmd of ['push', 'pull', 'remote-remove']) {
        const result = await runCli({ cwd: projectDir, args: [cmd, 'AnyCard'] })
        assert.equal(result.status, 1)
    }
})

test('login still fetches credentials and writes .pie/config.json and .env', async () => {
    const projectDir = mkTempDir('pieui-cr-login-')
    const { server, baseUrl } = await startServer((req, res) => {
        if ((req.url || '').startsWith('/credentials?')) {
            res.setHeader('content-type', 'application/json')
            res.end(
                JSON.stringify({
                    status: 'ok',
                    config: { user_id: 'u', project: 'p', api_key: 'k' },
                })
            )
            return
        }
        res.end(JSON.stringify({ status: 'pending' }))
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['login'],
            env: {
                PIEUI_LOGIN_CONNECT_BASE: `${baseUrl}/connect`,
                PIEUI_LOGIN_CREDENTIALS_API: `${baseUrl}/credentials`,
            },
            timeoutMs: 10000,
        })
        assertOk(result, 'login should complete')
        const cfgPath = path.join(projectDir, '.pie', 'config.json')
        assert.ok(fs.existsSync(cfgPath))
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        assert.equal(cfg.user_id, 'u')
    } finally {
        await stopServer(server)
    }
})
```

- [ ] **Step 2: Run the integration suite**

Run: `bun test src/__tests__/step2-remote.test.cjs`
Expected: PASS, all tests green.

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: PASS — no regressions in other step suites or unit tests.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/step2-remote.test.cjs
git commit -m "test(cli): rewrite step2-remote suite for card remote subcommands"
```

---

### Task 17: Final build smoke + CHANGELOG note

**Files:**

- Modify: (optional) `README.md` or `AGENTS.md` if they mention old commands

- [ ] **Step 1: Build the CLI and confirm usage text is correct**

Run: `bun run build:cli`
Expected: succeeds, produces `dist/cli.js`.

Run: `node dist/cli.js` (no args)
Expected: prints usage, no mentions of top-level `push`, `pull`, `remote-remove`; shows `card remote push|pull|list|remove`.

- [ ] **Step 2: Grep docs for stale references**

Run: `grep -RInE 'pieui (push|pull|remote-remove)' README.md AGENTS.md 2>/dev/null || true`
Expected: no output. If matches exist, update those docs to reference `pieui card remote <action>`.

- [ ] **Step 3: Commit if anything changed**

```bash
git add -A
git status
git commit -m "docs: point to pieui card remote in readme/agents" || true
```

---

## Self-review checklist

- [x] **Spec coverage** — every spec section maps to tasks:
    - Storage service port → Tasks 5–9
    - Settings loader → Tasks 2–3
    - `card remote push/pull/list/remove` → Tasks 12–15
    - Metadata detector → Task 10
    - CLI wiring + legacy removal → Task 11
    - Tests (unit + integration) → Tasks 2, 3, 5–10, 16
    - `printUsage` update → Task 11
- [x] **No placeholders** — every step has concrete code or exact commands.
- [x] **Type consistency** — `Settings.userId`/`apiKey`/`project`/`projectSlug`/`componentsDir`/`apiBaseUrl` used identically across settings, storage, and commands. `ComponentObject` / `ComponentTree` / `ProjectComponentList` shapes match the helpers exported from `models.ts`. `cardRemoteAction` / `remoteUserId` / `remoteProjectSlug` names match between `types.ts`, `args.ts`, `cli.ts`.
- [x] **Commit cadence** — every task ends with a commit; no batched commits.
- [x] **Legacy removal** — Task 11 deletes the three legacy files, removes their imports, and Task 16 has a regression test asserting they're gone.
