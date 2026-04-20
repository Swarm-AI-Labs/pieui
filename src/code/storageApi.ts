import fs from 'fs'
import os from 'os'
import path from 'path'

export const STORAGE_API_BASE_URL_ENV = 'PIEUI_STORAGE_API_BASE_URL'
export const STORAGE_API_KEY_ENV = 'PIEUI_STORAGE_API_KEY'
export const LEGACY_API_KEY_ENV = 'PIEUI_EXTERNAL_API_KEY'
export const STORAGE_USER_ID_ENV = 'PIEUI_STORAGE_USER_ID'
export const STORAGE_PROJECT_SLUG_ENV = 'PIEUI_STORAGE_PROJECT_SLUG'

const DEFAULT_STORAGE_API_BASE_URL = 'https://cdn-pieui.swarm.ing/api'

type PackageJson = {
    name?: string
}

export type StorageConfig = {
    apiBaseUrl: string
    apiKey: string
    userId: string
    projectSlug: string
}

export type ComponentObject = {
    key: string
    size?: number | null
    content_type?: string | null
    signed_url?: string | null
}

export type ComponentTree = {
    prefix: string
    typescript?: {
        objects?: ComponentObject[]
    }
}

export const toStoragePathPart = (raw: string): string => {
    const base = raw.trim().replace(/^@/, '').replaceAll('/', '-')
    const cleaned = base
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    return cleaned || 'project'
}

const readPackageJson = (): PackageJson | null => {
    const pkgPath = path.join(process.cwd(), 'package.json')
    try {
        if (!fs.existsSync(pkgPath)) {
            return null
        }
        return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson
    } catch {
        return null
    }
}

const getPackageScope = (packageName: string | undefined): string | undefined => {
    if (!packageName?.startsWith('@')) {
        return undefined
    }
    return packageName.slice(1).split('/')[0]
}

const getPackageProjectName = (
    packageName: string | undefined
): string | undefined => {
    if (!packageName) {
        return undefined
    }
    return packageName.includes('/')
        ? packageName.split('/').pop() || packageName
        : packageName
}

export const getStorageConfig = (): StorageConfig => {
    const pkg = readPackageJson()
    const userId =
        process.env[STORAGE_USER_ID_ENV] ||
        getPackageScope(pkg?.name) ||
        os.userInfo().username
    const projectSlug =
        process.env[STORAGE_PROJECT_SLUG_ENV] ||
        getPackageProjectName(pkg?.name) ||
        path.basename(process.cwd())
    const apiKey =
        process.env[STORAGE_API_KEY_ENV] || process.env[LEGACY_API_KEY_ENV]

    if (!apiKey) {
        throw new Error(
            `Missing API key. Set ${STORAGE_API_KEY_ENV} or ${LEGACY_API_KEY_ENV}.`
        )
    }

    return {
        apiBaseUrl: (
            process.env[STORAGE_API_BASE_URL_ENV] ||
            DEFAULT_STORAGE_API_BASE_URL
        ).replace(/\/+$/, ''),
        apiKey,
        userId: toStoragePathPart(userId),
        projectSlug: toStoragePathPart(projectSlug),
    }
}

export const getStorageHeaders = (config: StorageConfig): Record<string, string> => ({
    'x-api-key': config.apiKey,
})

export const encodePathPart = (value: string): string => encodeURIComponent(value)

export const encodeObjectPath = (value: string): string =>
    value.split('/').map(encodePathPart).join('/')

export const getComponentApiUrl = (
    config: StorageConfig,
    componentName: string
): string =>
    `${config.apiBaseUrl}/components/${encodePathPart(config.userId)}` +
    `/${encodePathPart(config.projectSlug)}/${encodePathPart(componentName)}`

export const formatRemoteName = (
    config: StorageConfig,
    componentName: string
): string => `${config.userId}/${config.projectSlug}/${componentName}`

export const responseError = async (
    action: string,
    response: Response
): Promise<Error> => {
    const text = await response.text().catch(() => '')
    return new Error(
        `${action} failed: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`
    )
}
