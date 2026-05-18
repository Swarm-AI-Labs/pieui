/**
 * Tests for `pieui card pull <ref>` — JSON file and URL sources.
 *
 * Critical invariants:
 *  - Reads only the `{typescript: {...}}` envelope; rejects python-only JSON.
 *  - File content is restored verbatim (no whitespace/encoding corruption).
 *  - Path traversal (`..' in file.path) is rejected.
 *  - Existing component directory is fully replaced.
 *  - Error message lists top-level keys when envelope is missing.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cardPullCommand } from '../code/commands/cardPull'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Build a minimal valid dump-metadata JSON (typescript envelope). */
const makeTypescriptDump = (
    componentName: string,
    files: Array<{ path: string; content: string }> = []
) => ({
    typescript: {
        name: componentName,
        files:
            files.length > 0
                ? files
                : [
                      {
                          path: `${componentName}/index.ts`,
                          content: `export default function ${componentName}() {}\n`,
                      },
                  ],
        packages: [],
        relativeImports: [],
        events: [],
        propsSchema: { type: 'object', properties: {} },
        propsCode: `interface ${componentName}Data {}`,
        eventsPropsSchema: {},
        eventsPropsCode: '',
        inputPropsCode: null,
        inputPropsSchema: null,
        ajaxList: [],
    },
})

// ---------------------------------------------------------------------------
// Pull from local JSON file
// ---------------------------------------------------------------------------

describe('cardPullCommand — local JSON file', () => {
    test('restores files from typescript envelope', async () => {
        const base = mkTempDir('pieui-pull-restore-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const componentName = 'HeroCard'
        const fileContent = `'use client'\nexport default function HeroCard() { return null }\n`
        const dump = makeTypescriptDump(componentName, [
            { path: `${componentName}/index.ts`, content: fileContent },
            {
                path: `${componentName}/ui/HeroCard.tsx`,
                content: fileContent,
            },
        ])

        const dumpFile = path.join(base, 'dump.json')
        fs.writeFileSync(dumpFile, JSON.stringify(dump), 'utf8')

        await runWithEnv(
            { PIE_COMPONENTS_DIR: componentsDir },
            () => cardPullCommand(dumpFile)
        )

        const restored = fs.readFileSync(
            path.join(componentsDir, `${componentName}/index.ts`),
            'utf8'
        )
        expect(restored).toBe(fileContent)
    })

    test('file content is restored verbatim — no whitespace mutation', async () => {
        const base = mkTempDir('pieui-pull-verbatim-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const content =
            `interface D {\n  label:\tstring\n  count:\tnumber\n}\n`
        const dump = makeTypescriptDump('TabCard', [
            { path: 'TabCard/types.ts', content },
        ])
        const dumpFile = path.join(base, 'dump.json')
        fs.writeFileSync(dumpFile, JSON.stringify(dump), 'utf8')

        await runWithEnv(
            { PIE_COMPONENTS_DIR: componentsDir },
            () => cardPullCommand(dumpFile)
        )

        const restored = fs.readFileSync(
            path.join(componentsDir, 'TabCard/types.ts'),
            'utf8'
        )
        expect(restored).toBe(content)
    })

    test('replaces existing component directory completely', async () => {
        const base = mkTempDir('pieui-pull-replace-')
        const componentsDir = path.join(base, 'piecomponents')
        const componentName = 'OldCard'

        // Pre-populate with stale file
        const staleDir = path.join(componentsDir, componentName)
        fs.mkdirSync(staleDir, { recursive: true })
        fs.writeFileSync(
            path.join(staleDir, 'stale.ts'),
            'export const stale = true\n',
            'utf8'
        )

        const newContent = `export const fresh = true\n`
        const dump = makeTypescriptDump(componentName, [
            { path: `${componentName}/fresh.ts`, content: newContent },
        ])
        const dumpFile = path.join(base, 'new.json')
        fs.writeFileSync(dumpFile, JSON.stringify(dump), 'utf8')

        await runWithEnv(
            { PIE_COMPONENTS_DIR: componentsDir },
            () => cardPullCommand(dumpFile)
        )

        // Stale file must be gone
        expect(
            fs.existsSync(path.join(componentsDir, componentName, 'stale.ts'))
        ).toBe(false)
        // Fresh file must exist
        expect(
            fs.existsSync(path.join(componentsDir, componentName, 'fresh.ts'))
        ).toBe(true)
    })

    test('rejects JSON without "typescript" key — shows top-level keys', async () => {
        const base = mkTempDir('pieui-pull-nokey-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        // Only python key (as if pie wrote it)
        const pythonOnly = { python: { name: 'FooCard', events: [] } }
        const dumpFile = path.join(base, 'python-only.json')
        fs.writeFileSync(dumpFile, JSON.stringify(pythonOnly), 'utf8')

        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow('typescript')

        // Error message must mention what keys are present
        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow('python')
    })

    test('rejects empty JSON object — shows "(none)" for top-level keys', async () => {
        const base = mkTempDir('pieui-pull-empty-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const dumpFile = path.join(base, 'empty.json')
        fs.writeFileSync(dumpFile, '{}', 'utf8')

        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow(/(none)|\(none\)/)
    })

    test('rejects invalid JSON', async () => {
        const base = mkTempDir('pieui-pull-badjson-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const dumpFile = path.join(base, 'bad.json')
        fs.writeFileSync(dumpFile, 'not json', 'utf8')

        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow()
    })

    test('TS side never reads python-keyed data from combined envelope', async () => {
        const base = mkTempDir('pieui-pull-combined-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const tsContent = `export const ts = true\n`
        // Combined file: both typescript and python keys
        const combined = {
            python: { name: 'ComboCard', files: [{ path: 'ComboCard/wrong.py', content: 'wrong' }] },
            typescript: {
                name: 'ComboCard',
                files: [{ path: 'ComboCard/correct.ts', content: tsContent }],
                packages: [],
                relativeImports: [],
                events: [],
                propsSchema: null,
                propsCode: '',
                eventsPropsSchema: {},
                eventsPropsCode: '',
                inputPropsCode: null,
                inputPropsSchema: null,
                ajaxList: [],
            },
        }
        const dumpFile = path.join(base, 'combined.json')
        fs.writeFileSync(dumpFile, JSON.stringify(combined), 'utf8')

        await runWithEnv(
            { PIE_COMPONENTS_DIR: componentsDir },
            () => cardPullCommand(dumpFile)
        )

        // Must restore TS file, not Python file
        expect(
            fs.existsSync(path.join(componentsDir, 'ComboCard/correct.ts'))
        ).toBe(true)
        expect(
            fs.existsSync(path.join(componentsDir, 'ComboCard/wrong.py'))
        ).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Path traversal protection
// ---------------------------------------------------------------------------

describe('cardPullCommand — path traversal protection', () => {
    test('rejects file path that escapes componentsDir via ..', async () => {
        const base = mkTempDir('pieui-pull-traversal-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const malicious = {
            typescript: {
                name: 'BadCard',
                files: [
                    {
                        path: '../../../etc/passwd',
                        content: 'hacked',
                    },
                ],
                packages: [],
                relativeImports: [],
                events: [],
                propsSchema: null,
                propsCode: '',
                eventsPropsSchema: {},
                eventsPropsCode: '',
                inputPropsCode: null,
                inputPropsSchema: null,
                ajaxList: [],
            },
        }
        const dumpFile = path.join(base, 'malicious.json')
        fs.writeFileSync(dumpFile, JSON.stringify(malicious), 'utf8')

        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow()

        // Verify the target was NOT written
        expect(fs.existsSync('/etc/passwd_hacked')).toBe(false)
    })

    test('rejects absolute file path in files[]', async () => {
        const base = mkTempDir('pieui-pull-abspath-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const malicious = {
            typescript: {
                name: 'AbsCard',
                files: [
                    {
                        path: '/tmp/injected.ts',
                        content: 'injected',
                    },
                ],
                packages: [],
                relativeImports: [],
                events: [],
                propsSchema: null,
                propsCode: '',
                eventsPropsSchema: {},
                eventsPropsCode: '',
                inputPropsCode: null,
                inputPropsSchema: null,
                ajaxList: [],
            },
        }
        const dumpFile = path.join(base, 'abs.json')
        fs.writeFileSync(dumpFile, JSON.stringify(malicious), 'utf8')

        await expect(
            runWithEnv(
                { PIE_COMPONENTS_DIR: componentsDir },
                () => cardPullCommand(dumpFile)
            )
        ).rejects.toThrow()
    })
})

// ---------------------------------------------------------------------------
// Pull from URL (fetch mock)
// ---------------------------------------------------------------------------

describe('cardPullCommand — URL source', () => {
    test('fetches JSON from URL and restores component', async () => {
        const base = mkTempDir('pieui-pull-url-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const urlContent = `export const fromUrl = true\n`
        const dump = makeTypescriptDump('UrlCard', [
            { path: 'UrlCard/index.ts', content: urlContent },
        ])

        const origFetch = global.fetch
        const origEnv = process.env.PIE_COMPONENTS_DIR
        global.fetch = (async (_url: any) => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => JSON.stringify(dump),
        })) as unknown as typeof fetch
        process.env.PIE_COMPONENTS_DIR = componentsDir

        try {
            await cardPullCommand('https://example.test/UrlCard.json')
        } finally {
            global.fetch = origFetch
            if (origEnv === undefined) delete process.env.PIE_COMPONENTS_DIR
            else process.env.PIE_COMPONENTS_DIR = origEnv
        }

        expect(
            fs.existsSync(path.join(componentsDir, 'UrlCard/index.ts'))
        ).toBe(true)
        const content = fs.readFileSync(
            path.join(componentsDir, 'UrlCard/index.ts'),
            'utf8'
        )
        expect(content).toBe(urlContent)
    })

    test('throws on non-200 HTTP response', async () => {
        const origFetch = global.fetch
        global.fetch = (async (_url: any) => ({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        })) as unknown as typeof fetch

        try {
            await expect(
                cardPullCommand('https://example.test/missing.json')
            ).rejects.toThrow('404')
        } finally {
            global.fetch = origFetch
        }
    })
})

// ---------------------------------------------------------------------------
// Local JSON path detection
// ---------------------------------------------------------------------------

describe('cardPullCommand — ref routing', () => {
    test('routes *.json existing file to JSON handler (not storage)', async () => {
        const base = mkTempDir('pieui-pull-routing-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        const dump = makeTypescriptDump('RoutedCard')
        // Name the file with .json suffix and make it exist
        const dumpFile = path.join(base, 'RoutedCard.json')
        fs.writeFileSync(dumpFile, JSON.stringify(dump), 'utf8')

        // Should succeed without touching storage (no PIE credentials needed)
        await expect(
            runWithEnv(
                {
                    PIE_COMPONENTS_DIR: componentsDir,
                    PIE_USER_ID: undefined,
                    PIE_PROJECT: undefined,
                },
                () => cardPullCommand(dumpFile)
            )
        ).resolves.toBeUndefined()
    })
})
