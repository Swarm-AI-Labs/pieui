/**
 * Storybook integration helpers used by `pieui create` and `pieui init`:
 *
 *   - `findStorybookMainPath(projectDir)` — locate `.storybook/main.{ts,mts,js,mjs,cjs}` if any.
 *   - `patchStorybookMainAddons(mainPath)` — add `@swarm.ing/pieui/storybook/addon` to the
 *     `addons:` array. Idempotent.
 *   - `installStorybook(projectDir, bunBin)` — invoke `bunx storybook@latest init` (or a
 *     mock binary via `PIEUI_STORYBOOK_INIT_BIN`) to scaffold Storybook into a fresh project.
 *
 * Behaviour-wise: `create` runs install + patch; `init` only patches if config exists.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ts } from './ts'

export const PIEUI_STORYBOOK_ADDON = '@swarm.ing/pieui/storybook/addon/preset'
export const PIEUI_STORYBOOK_STORIES_GLOB =
    '../piecomponents/**/*.stories.@(js|jsx|mjs|ts|tsx)'

const MAIN_CANDIDATES = [
    'main.ts',
    'main.mts',
    'main.js',
    'main.mjs',
    'main.cjs',
]

export const findStorybookMainPath = (projectDir: string): string | null => {
    const sbDir = path.join(projectDir, '.storybook')
    if (!fs.existsSync(sbDir) || !fs.statSync(sbDir).isDirectory()) return null
    for (const name of MAIN_CANDIDATES) {
        const candidate = path.join(sbDir, name)
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate
        }
    }
    return null
}

const findStringArrayProperty = (
    sourceFile: any,
    propertyName: string
): any | null => {
    let result: any = null
    const visit = (node: any): void => {
        if (result) return
        if (
            ts.isPropertyAssignment(node) &&
            ((ts.isIdentifier(node.name) && node.name.text === propertyName) ||
                (ts.isStringLiteral(node.name) &&
                    node.name.text === propertyName)) &&
            ts.isArrayLiteralExpression(node.initializer)
        ) {
            result = node.initializer
            return
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return result
}

const addEntryToArrayProperty = (
    mainPath: string,
    propertyName: string,
    entry: string
): boolean => {
    if (!fs.existsSync(mainPath)) return false
    const source = fs.readFileSync(mainPath, 'utf8')

    if (source.includes(`'${entry}'`) || source.includes(`"${entry}"`)) {
        return false
    }

    const isTs = /\.(ts|mts)$/.test(mainPath)
    const sourceFile = ts.createSourceFile(
        mainPath,
        source,
        ts.ScriptTarget.ES2020,
        true,
        isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    )

    const array = findStringArrayProperty(sourceFile, propertyName)
    if (!array) return false

    const open = array.getStart(sourceFile)
    const close = array.getEnd()
    const elements: any[] = array.elements
    const arrayText = source.slice(open, close)
    const isMultiline = arrayText.includes('\n')

    let newSource: string

    if (elements.length === 0) {
        if (isMultiline) {
            // `[\n      \n    ]` — match the closing-bracket indent for the new entry.
            const newlineBeforeClose = source.lastIndexOf('\n', close - 1)
            const closeIndent = source.slice(newlineBeforeClose + 1, close - 1)
            const elementIndent = closeIndent + '    '
            const insertion = `${elementIndent}'${entry}',\n`
            newSource =
                source.slice(0, newlineBeforeClose + 1) +
                insertion +
                source.slice(newlineBeforeClose + 1)
        } else {
            // `[]` → `['<entry>']`
            newSource =
                source.slice(0, close - 1) +
                `'${entry}'` +
                source.slice(close - 1)
        }
    } else if (!isMultiline) {
        // `[a, b]` inline → `[a, b, '<entry>']`
        newSource =
            source.slice(0, close - 1) +
            `, '${entry}'` +
            source.slice(close - 1)
    } else {
        // Multi-line with elements: match the indent of the last element.
        const lastEl = elements[elements.length - 1]
        const lastElStart = lastEl.getStart(sourceFile)
        const lineStart = source.lastIndexOf('\n', lastElStart) + 1
        const elementIndent = source.slice(lineStart, lastElStart)

        const tail = source.slice(lastEl.getEnd(), close - 1)
        const hasTrailingComma = /,/.test(tail)
        const newlineBeforeClose = source.lastIndexOf('\n', close - 1)
        const insertion = `${elementIndent}'${entry}',\n`

        if (hasTrailingComma) {
            // Insert just before the closing-bracket line.
            newSource =
                source.slice(0, newlineBeforeClose + 1) +
                insertion +
                source.slice(newlineBeforeClose + 1)
        } else {
            // Add trailing comma on the previous line first.
            newSource =
                source.slice(0, lastEl.getEnd()) +
                ',\n' +
                insertion.trimEnd() +
                '\n' +
                source.slice(newlineBeforeClose + 1)
        }
    }

    fs.writeFileSync(mainPath, newSource, 'utf8')
    return true
}

export const patchStorybookMainAddons = (mainPath: string): boolean =>
    addEntryToArrayProperty(mainPath, 'addons', PIEUI_STORYBOOK_ADDON)

export const patchStorybookMainStories = (mainPath: string): boolean =>
    addEntryToArrayProperty(mainPath, 'stories', PIEUI_STORYBOOK_STORIES_GLOB)

const resolveStorybookInitBin = (
    fallbackBunBin: string
): { bin: string; args: string[] } => {
    const override = process.env.PIEUI_STORYBOOK_INIT_BIN
    if (override) {
        return { bin: override, args: [] }
    }
    return {
        bin: fallbackBunBin,
        args: ['x', 'storybook@latest', 'init', '--yes', '--no-dev'],
    }
}

export type StorybookSetupResult = {
    installed: boolean
    mainPath: string | null
    patched: boolean
    error?: string
}

export const installStorybook = (
    projectDir: string,
    fallbackBunBin = 'bun'
): { installed: boolean; error?: string } => {
    const { bin, args } = resolveStorybookInitBin(fallbackBunBin)
    const result = spawnSync(bin, args, {
        cwd: projectDir,
        stdio: 'inherit',
        env: process.env,
    })
    if (result.error) {
        return { installed: false, error: result.error.message }
    }
    if (result.status !== 0) {
        return {
            installed: false,
            error: `${bin} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}`,
        }
    }
    return { installed: true }
}

export const installAndWireStorybook = (
    projectDir: string,
    fallbackBunBin = 'bun'
): StorybookSetupResult => {
    console.log('[pieui] Installing Storybook (this may take a minute)...')
    const install = installStorybook(projectDir, fallbackBunBin)
    if (!install.installed) {
        console.warn(
            `[pieui] Warning: Storybook install failed (${install.error ?? 'unknown'}). Skipping addon wiring.`
        )
        return {
            installed: false,
            mainPath: null,
            patched: false,
            error: install.error,
        }
    }
    const mainPath = findStorybookMainPath(projectDir)
    if (!mainPath) {
        console.warn(
            '[pieui] Warning: Storybook install reported success but .storybook/main.* was not found. Addon not wired.'
        )
        return { installed: true, mainPath: null, patched: false }
    }
    const patchedAddons = patchStorybookMainAddons(mainPath)
    if (patchedAddons) {
        console.log(`[pieui] Added '${PIEUI_STORYBOOK_ADDON}' to ${mainPath}`)
    } else {
        console.log(
            `[pieui] '${PIEUI_STORYBOOK_ADDON}' already present in ${mainPath}`
        )
    }
    const patchedStories = patchStorybookMainStories(mainPath)
    if (patchedStories) {
        console.log(
            `[pieui] Added '${PIEUI_STORYBOOK_STORIES_GLOB}' to stories in ${mainPath}`
        )
    }
    return {
        installed: true,
        mainPath,
        patched: patchedAddons || patchedStories,
    }
}
