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
        expect(() => normalizeObjectPath('/etc/passwd')).toThrow(PieStorageError)
    })
    test('rejects .. segments', () => {
        expect(() => normalizeObjectPath('../escape')).toThrow(PieStorageError)
    })
    test('rejects . segments', () => {
        expect(() => normalizeObjectPath('./ok')).toThrow(PieStorageError)
    })
    test('rejects empty segments', () => {
        expect(() => normalizeObjectPath('ui//view.tsx')).toThrow(PieStorageError)
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
        const s = new PieStorageService(
            makeSettings({ userId: undefined })
        )
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
            service.metadataUrl({ componentName: 'Card', schemaKind: 'eventSchema' })
        ).toBe(
            'https://example.test/api/components/demo-user/demo-proj/Card/metadata/eventSchema'
        )
    })
})
