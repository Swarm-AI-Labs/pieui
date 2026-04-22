import type { Settings } from './settings'
import {
    parseComponentObject,
    parseComponentRevisionList,
    parseProjectComponentList,
    type ComponentObject,
    type ComponentRevisionList,
    type ComponentTree,
    type ProjectComponentList,
} from './models'

export const STORAGE_LANGUAGE = 'typescript'

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

export class PieStorageService {
    private readonly settings: Settings
    private readonly baseUrl: string

    constructor(settings: Settings) {
        this.settings = settings
        this.baseUrl = settings.apiBaseUrl.replace(/\/+$/, '')
    }

    projectComponentsUrl(args: { userId: string; project: string }): string {
        return `${this.baseUrl}/components/${pathPart(args.userId)}/${pathPart(args.project)}`
    }

    componentUrl(args: {
        componentName: string
        userId?: string
        project?: string
    }): string {
        const userId = args.userId ?? this.settings.userId
        const slug = args.project ?? this.settings.project
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
        project?: string
        revision?: number
    }): string {
        const base = this.componentUrl(args)
        const encodedPath = normalizeObjectPath(args.objectPath)
        if (args.revision !== undefined) {
            return `${base}/revisions/${args.revision}/${STORAGE_LANGUAGE}/${encodedPath}`
        }
        return `${base}/${STORAGE_LANGUAGE}/${encodedPath}`
    }

    componentTreeUrl(args: {
        componentName: string
        userId?: string
        project?: string
        revision?: number
    }): string {
        const base = this.componentUrl(args)
        if (args.revision !== undefined) {
            return `${base}/revisions/${args.revision}`
        }
        return base
    }

    revisionsUrl(args: {
        componentName: string
        userId?: string
        project?: string
    }): string {
        return `${this.componentUrl(args)}/revisions`
    }

    languageBatchUrl(args: {
        componentName: string
        userId?: string
        project?: string
    }): string {
        return `${this.componentUrl(args)}/batch/${STORAGE_LANGUAGE}`
    }

    metadataUrl(args: {
        componentName: string
        schemaKind: string
        userId?: string
        project?: string
    }): string {
        return `${this.componentUrl(args)}/metadata/${encodeURIComponent(args.schemaKind)}`
    }

    async listProjectComponents(args: {
        userId: string
        project: string
    }): Promise<ProjectComponentList> {
        const url = this.projectComponentsUrl(args)
        const response = await this.request({ method: 'GET', url })
        return parseProjectComponentList(await response.json())
    }

    async listComponent(args: {
        componentName: string
        userId?: string
        project?: string
        revision?: number
    }): Promise<ComponentTree> {
        const url = this.componentTreeUrl(args)
        const response = await this.request({ method: 'GET', url })
        const payload = (await response.json()) as Record<string, unknown>
        if (args.revision !== undefined) {
            const inner = (payload as { tree?: ComponentTree }).tree
            if (inner !== undefined) return inner
        }
        return payload as ComponentTree
    }

    async listRevisions(args: {
        componentName: string
        userId?: string
        project?: string
    }): Promise<ComponentRevisionList> {
        const url = this.revisionsUrl(args)
        const response = await this.request({ method: 'GET', url })
        return parseComponentRevisionList(await response.json())
    }

    async deleteComponent(args: {
        componentName: string
        userId?: string
        project?: string
    }): Promise<void> {
        const url = this.componentUrl(args)
        await this.request({ method: 'DELETE', url })
    }

    async uploadMetadataContent(args: {
        componentName: string
        schemaKind: SchemaKind
        content: Uint8Array
        userId?: string
        project?: string
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
        project?: string
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
        project?: string
    }): Promise<void> {
        metadataContentType(args.schemaKind)
        await this.request({ method: 'DELETE', url: this.metadataUrl(args) })
    }

    async uploadLanguageFilesBatch(args: {
        componentName: string
        files: Array<[string, string]>
        userId?: string
        project?: string
    }): Promise<ComponentObject[]> {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const items = args.files.map(([objectPath, filePath]) => ({
            objectPath: normalizeObjectPath(objectPath),
            filePath: path.resolve(filePath),
        }))
        for (const item of items) {
            if (
                !fs.existsSync(item.filePath) ||
                !fs.statSync(item.filePath).isFile()
            ) {
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

    async uploadComponentDirectory(args: {
        componentName: string
        sourceDir: string
        userId?: string
        project?: string
    }): Promise<ComponentObject[]> {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const source = path.resolve(args.sourceDir)
        if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
            throw new PieStorageError(
                `component directory not found: ${source}`
            )
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
            project: args.project,
        })
    }

    async downloadLanguageFile(args: {
        componentName: string
        objectPath: string
        targetPath: string
        userId?: string
        project?: string
        revision?: number
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
        project?: string
        revision?: number
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
}
