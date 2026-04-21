import { describe, test, expect } from 'bun:test'
import { parseDotenv } from '../code/services/settings'

describe('parseDotenv', () => {
    test('parses KEY=value lines', () => {
        expect(parseDotenv('A=1\nB=two\n')).toEqual({ A: '1', B: 'two' })
    })

    test('strips matching double and single quotes', () => {
        expect(
            parseDotenv(`A="hello world"\nB='x y'\n`)
        ).toEqual({ A: 'hello world', B: 'x y' })
    })

    test('ignores blank lines and # comments', () => {
        expect(
            parseDotenv(`# comment\n\nA=1\n# another\nB=2\n`)
        ).toEqual({ A: '1', B: '2' })
    })

    test('ignores malformed lines without =', () => {
        expect(parseDotenv('JUSTAWORD\nA=ok\n')).toEqual({ A: 'ok' })
    })

    test('handles values that contain =', () => {
        expect(parseDotenv('A=x=y=z\n')).toEqual({ A: 'x=y=z' })
    })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadSettings } from '../code/services/settings'

const mkTempDir = (prefix: string) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const runWithEnv = <T>(env: Record<string, string | undefined>, fn: () => T): T => {
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
            { PIE_USER_ID: 'u', PIE_PROJECT: undefined, PIE_PROJECT_SLUG: undefined },
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
