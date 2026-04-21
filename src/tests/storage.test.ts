import { describe, test, expect } from 'bun:test'
import {
    PieStorageError,
    PieStorageService,
    normalizeObjectPath,
} from '../code/services/storage'
import type { Settings } from '../code/services/settings'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import fsNode from 'node:fs'
import osNode from 'node:os'
import pathNode from 'node:path'

const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
    userId: 'demo-user',
    apiKey: 'demo-key',
    project: 'demo-proj',
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
            service.projectComponentsUrl({ userId: 'u', project: 's' })
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
                project: 's2',
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
                project: 's',
            })
            expect(result.userId).toBe('u')
            expect(result.project).toBe('s')
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
                service.listProjectComponents({ userId: 'u', project: 's' })
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
            await service.listProjectComponents({ userId: 'u', project: 's' })
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
