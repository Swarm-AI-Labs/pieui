import type { Settings } from './settings'
import {
    parseProjectComponentList,
    type ComponentTree,
    type ProjectComponentList,
} from './models'

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
