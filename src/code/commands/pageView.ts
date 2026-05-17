import fs from 'node:fs'
import path from 'node:path'

const normalizePagePath = (pagePath: string): string => {
    const trimmed = pagePath.trim()
    if (!trimmed) throw new Error('Path is required for page view command')
    const slashed = trimmed.replace(/\\/g, '/')
    const noRel = slashed.replace(/^\.\/+/, '')
    const noApp = noRel.replace(/^app\//, '')
    const noEdge = noApp.replace(/^\/+|\/+$/g, '')
    const normalized = path.posix.normalize(noEdge)
    if (!normalized || normalized === '.') {
        throw new Error('Path is required for page view command')
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

export const pageViewCommand = (pagePath: string): void => {
    const normalized = normalizePagePath(pagePath)
    const target = path.join(process.cwd(), 'app', normalized, 'page.tsx')
    if (!fs.existsSync(target)) {
        throw new Error(`Page file not found: ${target}`)
    }
    const source = fs.readFileSync(target, 'utf8')
    console.log(`[pieui] Path: ${target}`)
    console.log('')
    process.stdout.write(source)
    if (!source.endsWith('\n')) console.log('')
}