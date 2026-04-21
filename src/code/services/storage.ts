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
}
