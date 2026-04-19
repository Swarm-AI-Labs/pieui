import fs from 'fs'
import path from 'path'
import { pageTemplate } from '../templates'

const normalizePagePath = (pagePath: string): string => {
    const trimmed = pagePath.trim()

    if (!trimmed) {
        throw new Error('Path is required for page add command')
    }

    const normalizedSlashes = trimmed.replace(/\\/g, '/')
    const withoutRelativePrefix = normalizedSlashes.replace(/^\.\/+/, '')
    const withoutAppPrefix = withoutRelativePrefix.replace(/^app\//, '')
    const withoutEdgeSlashes = withoutAppPrefix.replace(/^\/+|\/+$/g, '')
    const normalized = path.posix.normalize(withoutEdgeSlashes)

    if (!normalized || normalized === '.') {
        throw new Error('Path is required for page add command')
    }

    if (
        normalized === '..' ||
        normalized.startsWith('../') ||
        normalized.includes('/../')
    ) {
        throw new Error('Page path must stay inside the app directory')
    }

    return normalized
}

const toPascalCase = (value: string): string =>
    value
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')

const pageComponentNameForPath = (pagePath: string): string => {
    const segments = pagePath
        .split('/')
        .map((segment) => toPascalCase(segment))
        .filter(Boolean)

    if (segments.length === 0) {
        return 'Page'
    }

    return `${segments.join('')}Page`
}

export const pageAddCommand = (pagePath: string) => {
    const normalizedPath = normalizePagePath(pagePath)
    const pageComponentName = pageComponentNameForPath(normalizedPath)
    const appDir = path.join(process.cwd(), 'app')
    const targetFile = path.join(appDir, normalizedPath, 'page.tsx')
    const relativeTarget = path.relative(appDir, targetFile)

    if (
        relativeTarget.startsWith('..') ||
        path.isAbsolute(relativeTarget)
    ) {
        throw new Error('Page path must stay inside the app directory')
    }

    if (fs.existsSync(targetFile)) {
        console.error(
            `[pieui] Error: Page already exists at app/${normalizedPath}/page.tsx`
        )
        process.exit(1)
    }

    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.writeFileSync(targetFile, pageTemplate(pageComponentName), 'utf8')

    console.log(
        `[pieui] Page created successfully at app/${normalizedPath}/page.tsx`
    )
}
