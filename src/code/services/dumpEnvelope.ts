import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from './settings'

type FileEntry = { path: string; content: string }

export type RestoredComponent = {
    componentName: string
    written: string[]
}

/**
 * Strictly unwrap the `{typescript: {...}}` envelope from a dump-metadata
 * payload. TS-side code only reads its own envelope key.
 */
export const unwrapTypescriptEnvelope = (
    parsed: unknown
): Record<string, unknown> => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('dump-metadata payload is not a JSON object')
    }
    const obj = parsed as Record<string, unknown>
    const inner = obj.typescript
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
        const keys = Object.keys(obj).join(', ') || '(none)'
        throw new Error(
            'dump-metadata payload is missing the "typescript" envelope ' +
                `(top-level keys: {${keys}})`
        )
    }
    return inner as Record<string, unknown>
}

/**
 * Reconstruct a component directory from a parsed envelope. The envelope
 * carries `{typescript: {name, files: [{path, content}], ...}}`.
 *
 * `files[].path` is relative to `<componentsDir>` (e.g. `BoxCard/index.ts`).
 * Each entry is written verbatim, preserving directory structure. An
 * existing component dir is wiped first.
 *
 * `label` is used in error messages (file path, URL, or remote ref).
 */
export const restoreComponentFromEnvelope = (
    envelope: unknown,
    label: string
): RestoredComponent => {
    const inner = unwrapTypescriptEnvelope(envelope)
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
    // Pre-flight: validate every entry before touching disk so a bad payload
    // does not wipe the existing component dir.
    const planned: Array<{ target: string; content: string }> = []
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
        const relCheck = path.relative(settings.componentsDir, target)
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
            throw new Error(
                `${label}: file path "${fe.path}" escapes componentsDir`
            )
        }
        planned.push({ target, content: fe.content })
    }

    fs.mkdirSync(settings.componentsDir, { recursive: true })
    const componentDir = path.join(settings.componentsDir, componentName)
    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    const written: string[] = []
    for (const item of planned) {
        fs.mkdirSync(path.dirname(item.target), { recursive: true })
        fs.writeFileSync(item.target, item.content, 'utf8')
        written.push(item.target)
    }
    return { componentName, written }
}

/**
 * Parse a raw dump-metadata JSON string and reconstruct the component.
 * Wrapper around `restoreComponentFromEnvelope`.
 */
export const restoreComponentFromEnvelopeText = (
    raw: string,
    label: string
): RestoredComponent => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (e) {
        throw new Error(`${label} is not valid JSON: ${(e as Error).message}`)
    }
    return restoreComponentFromEnvelope(parsed, label)
}
