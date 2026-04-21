import { describe, test, expect } from 'bun:test'
import {
    PieStorageError,
    PieStorageService,
    normalizeObjectPath,
} from '../code/services/storage'
import type { Settings } from '../code/services/settings'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

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

type Recorded = {
    method?: string
    url?: string
    headers: http.IncomingHttpHeaders
    body: Buffer
}

const startServer = async (
    handler: (req: http.IncomingMessage, res: http.ServerResponse, body: Buffer) => void
): Promise<{ baseUrl: string; close: () => Promise<void>; requests: Recorded[] }> => {
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
            res.end(JSON.stringify({ user_id: 'u', project_slug: 's', components: [] }))
        })
        try {
            const service = new PieStorageService(
                makeSettings({
                    apiBaseUrl: `${mock.baseUrl}/api`,
                    apiKey: undefined,
                })
            )
            await service.listProjectComponents({ userId: 'u', projectSlug: 's' })
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
                            { key: 'users/u/projects/s/components/Card/typescript/ui/view.tsx' },
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
