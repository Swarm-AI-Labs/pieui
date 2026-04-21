import type { Settings } from './settings'
import {
    parseComponentObject,
    parseProjectComponentList,
    type ComponentObject,
    type ComponentTree,
    type ProjectComponentList,
} from './models'

export const STORAGE_LANGUAGE = 'typescript'

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

const cleanFetchError = (method: string, url: string, error: unknown): Error => {
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

    projectComponentsUrl(args: { userId: string; projectSlug: string }): string {
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
