/**
 * `pieui card dump-metadata <Name>` — emit PieMetadata JSON.
 *
 * This module is the orchestration layer. All introspection algorithms
 * live in `code/introspection/` — see that package's JSDoc for inputs,
 * outputs, and algorithmic assumptions of each piece.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../services/settings'
import {
    buildSchemaForType,
    collectComponentFiles,
    createSchemaContext,
    extractAjaxList,
    extractDescription,
    extractEvents,
    extractEventsPayloads,
    extractImports,
    findComponentDataTypeForName,
    findStoredAttributeType,
    typeToSchema,
} from '../introspection'
import type { JSONSchema, PieFileEntry, PieMetadata } from '../types'

const COMPONENT_EXTS = ['.ts', '.tsx']

/**
 * Deterministic JSON serializer — sort keys at every depth, end with
 * trailing newline. Cycles in nested objects are silently broken
 * (set to `undefined`).
 */
const stableStringify = (value: unknown): string => {
    const seen = new WeakSet<object>()
    const norm = (v: any): any => {
        if (v === null || typeof v !== 'object') return v
        if (seen.has(v)) return undefined
        seen.add(v)
        if (Array.isArray(v)) return v.map(norm)
        const sortedKeys = Object.keys(v).sort()
        const out: Record<string, unknown> = {}
        for (const k of sortedKeys) out[k] = norm(v[k])
        return out
    }
    return JSON.stringify(norm(value), null, 2) + '\n'
}

/**
 * Build the PieMetadata object for a component.
 *
 * INPUTS:
 *   - `componentName`: the PascalCase card name. Must correspond to a
 *     directory `<settings.componentsDir>/<componentName>/`.
 *
 * RETURNS: full PieMetadata object (see `types.ts`).
 *
 * ASSUMPTIONS:
 *   - The component's data type follows naming convention
 *     `<Name>Data` / `I<Name>Data` / `<Name>Props` (see findDataType).
 *   - `<PieCard>` JSX usage is the source of truth for events; methods
 *     must be an inline object literal (see extractEvents).
 *   - Input variant is detected ONLY via `<PieCard stored={X}/>`
 *     (see findInputType — policy decision in spec discussion).
 *
 * PIPELINE:
 *   1. Glob component files (collectComponentFiles).
 *   2. Build TS program/checker context (createSchemaContext).
 *   3. Find props data type via naming convention.
 *   4. Extract events strictly from `<PieCard methods={…}>`.
 *   5. Recover each event handler's payload type.
 *   6. Find input type via `<PieCard stored={X}/>`.
 *   7. Split imports into packages / relativeImports.
 */
export const buildCardMetadata = (componentName: string): PieMetadata => {
    const settings = loadSettings()
    const componentDir = path.join(settings.componentsDir, componentName)
    if (!fs.existsSync(componentDir)) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const files = collectComponentFiles(componentDir)
    if (files.length === 0) {
        throw new Error(`No files found in ${componentDir}`)
    }

    const tsFiles = files.filter((f) =>
        COMPONENT_EXTS.some((e) => f.endsWith(e))
    )
    const ctx = createSchemaContext(tsFiles)

    const componentsDir = settings.componentsDir
    const fileEntries: PieFileEntry[] = files.map((absPath) => ({
        path: path.relative(componentsDir, absPath),
        content: fs.readFileSync(absPath, 'utf8'),
    }))

    const dataType = findComponentDataTypeForName(ctx, componentName)
    const propsCode = dataType.declaration.getText()
    const propsSchema = buildSchemaForType(ctx, dataType.typeName)

    const ajaxList = extractAjaxList(dataType.declaration)

    const events = extractEvents(tsFiles)
    const { code: eventsPropsCode, schema: eventsPropsSchema } =
        extractEventsPayloads(ctx, tsFiles, events)

    const description = extractDescription(
        ctx,
        componentName,
        tsFiles,
        dataType.declaration,
        events
    )

    const inputType = findStoredAttributeType(ctx, tsFiles)
    const inputPropsCode = inputType ? inputType.declaration.getText() : null
    let inputPropsSchema: JSONSchema | null = null
    if (inputType) {
        inputPropsSchema = buildSchemaForType(ctx, inputType.typeName)
        if (!inputPropsSchema) {
            const t = ctx.checker.getTypeAtLocation(
                inputType.declaration.name ?? inputType.declaration
            )
            if (t) inputPropsSchema = typeToSchema(t, ctx.checker)
        }
    }

    const importSplit = extractImports(tsFiles)
    const componentFileSet = new Set(files)
    const relativeImports = importSplit.relativeImports.filter(
        (p) => !componentFileSet.has(p)
    )
    const packages = importSplit.packages

    return {
        name: componentName,
        files: fileEntries,
        packages,
        relativeImports,
        events,
        propsSchema,
        propsCode,
        description,
        eventsPropsSchema,
        eventsPropsCode,
        inputPropsCode,
        inputPropsSchema,
        ajaxList,
    }
}

export const stringifyPieMetadata = (meta: PieMetadata): string =>
    stableStringify(meta)

/**
 * Top-level wrap envelope. Each CLI side wraps its metadata under
 * `typescript` / `python` so a consumer can combine both ecosystems
 * into one document for cross-side comparison.
 */
export const DUMP_METADATA_ENVELOPE_KEY = 'typescript' as const

/**
 * Merge our envelope key into the existing JSON at `target` (if any),
 * preserving sibling top-level keys (e.g. the `python` envelope written
 * by `pie card dump-metadata --out <same-file>`).
 *
 * Top-level merge is intentionally shallow: re-running `pieui` on the
 * same file replaces our `typescript` key in full but never touches
 * `python` (or future keys).
 */
const mergeEnvelopeIntoFile = (
    target: string,
    envelope: Record<string, unknown>
): Record<string, unknown> => {
    if (!fs.existsSync(target)) return envelope
    let existing: unknown
    try {
        existing = JSON.parse(fs.readFileSync(target, 'utf8'))
    } catch (e) {
        throw new Error(
            `[pieui] Cannot merge: existing file ${target} is not valid JSON ` +
                `(${(e as Error).message})`
        )
    }
    if (
        existing === null ||
        typeof existing !== 'object' ||
        Array.isArray(existing)
    ) {
        throw new Error(
            `[pieui] Cannot merge: existing file ${target} is not a JSON object`
        )
    }
    return { ...(existing as Record<string, unknown>), ...envelope }
}

/** CLI entry point. Builds metadata, writes to `outFile` or stdout. */
export const cardDumpMetadataCommand = (
    componentName: string,
    outFile: string | undefined
): void => {
    const meta = buildCardMetadata(componentName)
    const envelope: Record<string, unknown> = {
        [DUMP_METADATA_ENVELOPE_KEY]: meta,
    }
    if (outFile) {
        const resolved = path.resolve(process.cwd(), outFile)
        const merged = mergeEnvelopeIntoFile(resolved, envelope)
        const json = stableStringify(merged)
        fs.mkdirSync(path.dirname(resolved), { recursive: true })
        fs.writeFileSync(resolved, json, 'utf8')
        console.log(`[pieui] Wrote metadata: ${resolved}`)
    } else {
        process.stdout.write(stableStringify(envelope))
    }
}
