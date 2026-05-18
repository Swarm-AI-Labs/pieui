import fs from 'node:fs'
import path from 'node:path'
import { cardRemotePullCommand } from './cardRemote/pull'
import { loadSettings } from '../services/settings'

const isHttpUrl = (ref: string): boolean => /^https?:\/\//i.test(ref)

const isLocalJsonPath = (ref: string): boolean => {
    if (
        ref.startsWith('./') ||
        ref.startsWith('../') ||
        ref.startsWith('/') ||
        ref.startsWith('~')
    ) {
        return true
    }
    if (!ref.endsWith('.json')) return false
    return fs.existsSync(path.resolve(process.cwd(), ref))
}

const fetchJsonText = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`)
    }
    return await res.text()
}

/**
 * Strictly unwrap the `{typescript: {...}}` envelope from a dump-metadata
 * JSON. TS code only reads its own envelope key.
 */
const unwrapTypescript = (parsed: unknown): Record<string, unknown> => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('dump-metadata payload is not a JSON object')
    }
    const obj = parsed as Record<string, unknown>
    const inner = obj.typescript
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
        const keys = Object.keys(obj).join(', ') || '(none)'
        throw new Error(
            'dump-metadata payload is missing the "typescript" envelope ' +
                `(top-level keys: ${keys})`
        )
    }
    return inner as Record<string, unknown>
}

type FileEntry = { path: string; content: string }

/**
 * Reconstruct a component directory from a dump-metadata JSON file.
 *
 * The dump's `files` field is `{path, content}[]` where `path` is
 * relative to `<componentsDir>` (e.g. `BoxCard/index.ts`). We write
 * each entry verbatim, preserving directory structure.
 *
 * Replaces an existing component dir if present (same behavior as
 * remote pull).
 */
const pullFromDumpJson = (raw: string, label: string): void => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (e) {
        throw new Error(`${label} is not valid JSON: ${(e as Error).message}`)
    }
    const inner = unwrapTypescript(parsed)
    const componentName = inner.name
    const files = inner.files
    if (typeof componentName !== 'string' || !componentName) {
        throw new Error(`${label}: typescript.name is missing or empty`)
    }
    if (!Array.isArray(files)) {
        throw new Error(
            `${label}: typescript.files must be an array of {path, content}`
        )
    }
    const settings = loadSettings()
    fs.mkdirSync(settings.componentsDir, { recursive: true })
    const componentDir = path.join(settings.componentsDir, componentName)
    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    const written: string[] = []
    for (const entry of files) {
        if (
            !entry ||
            typeof entry !== 'object' ||
            typeof (entry as FileEntry).path !== 'string' ||
            typeof (entry as FileEntry).content !== 'string'
        ) {
            throw new Error(
                `${label}: every files[] entry must be {path: string, content: string}`
            )
        }
        const fe = entry as FileEntry
        const target = path.resolve(settings.componentsDir, fe.path)
        // safety: ensure target stays under componentsDir
        const relCheck = path.relative(settings.componentsDir, target)
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
            throw new Error(
                `${label}: file path "${fe.path}" escapes componentsDir`
            )
        }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, fe.content, 'utf8')
        written.push(target)
    }
    console.log(`[pieui] Pulled card from ${label}: ${componentName}`)
    for (const w of written) console.log(`[pieui] Path: ${w}`)
}

export const cardPullCommand = async (cardRef: string): Promise<void> => {
    if (isHttpUrl(cardRef)) {
        console.log(`[pieui] Fetching dump from ${cardRef}`)
        const raw = await fetchJsonText(cardRef)
        pullFromDumpJson(raw, cardRef)
        return
    }
    if (isLocalJsonPath(cardRef)) {
        const abs = path.resolve(process.cwd(), cardRef)
        if (!fs.existsSync(abs)) {
            throw new Error(`Pull source not found: ${abs}`)
        }
        if (!fs.statSync(abs).isFile()) {
            throw new Error(`Pull source is not a file: ${abs}`)
        }
        pullFromDumpJson(fs.readFileSync(abs, 'utf8'), abs)
        return
    }
    await cardRemotePullCommand(cardRef)
}
