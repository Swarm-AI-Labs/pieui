/**
 * Resolve the path to the linked backend project, stored in
 * `.pie/config.json` under `backendProjectDir`. Prompts the user
 * interactively if not yet configured AND stdin is a TTY.
 *
 * Used by both `login` (to push credentials cross-side) and
 * `check-sync` (to spawn `pie card check-sync`).
 */

import fs from 'node:fs'
import path from 'node:path'
import * as readline from 'node:readline/promises'

const PIE_CONFIG_DIR = '.pie'
const PIE_CONFIG_FILE = 'config.json'

export type PieConfig = {
    backendProjectDir?: string
    backendComponentsDir?: string
    [key: string]: unknown
}

export const configPathFor = (cwd: string): string =>
    path.join(cwd, PIE_CONFIG_DIR, PIE_CONFIG_FILE)

export const readConfig = (cwd: string): PieConfig => {
    const p = configPathFor(cwd)
    if (!fs.existsSync(p)) return {}
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
        return typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? (parsed as PieConfig)
            : {}
    } catch {
        return {}
    }
}

export const writeConfig = (cwd: string, config: PieConfig): void => {
    const dir = path.join(cwd, PIE_CONFIG_DIR)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
        configPathFor(cwd),
        JSON.stringify(config, null, 2) + '\n',
        'utf8'
    )
}

const walkUpForPyproject = (start: string): string | null => {
    let dir = path.resolve(start)
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return dir
        dir = path.dirname(dir)
    }
    return null
}

/**
 * Resolve `backendProjectDir` for the project at `cwd`.
 *
 *   1. If config already has `backendProjectDir` and the path exists → use it.
 *   2. Else if `backendComponentsDir` is set → walk up to nearest
 *      `pyproject.toml`, persist as `backendProjectDir`, return.
 *   3. Else if TTY → prompt the user, persist, return.
 *   4. Else → return `null` (caller decides whether to error).
 */
export const ensureBackendDir = async (
    cwd: string
): Promise<string | null> => {
    const config = readConfig(cwd)
    if (config.backendProjectDir) {
        const dir = path.resolve(cwd, config.backendProjectDir as string)
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir
        console.error(
            `[pieui] Configured backendProjectDir not found: ${dir}`
        )
    }
    if (config.backendComponentsDir) {
        const derived = walkUpForPyproject(config.backendComponentsDir as string)
        if (derived) {
            config.backendProjectDir = derived
            writeConfig(cwd, config)
            console.log(
                `[pieui] Derived backendProjectDir from backendComponentsDir → ${derived}`
            )
            return derived
        }
    }

    if (!process.stdin.isTTY) {
        console.error(
            `[pieui] Non-interactive shell — add "backendProjectDir" to ${configPathFor(cwd)}`
        )
        return null
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    try {
        const raw = (
            await rl.question('[pieui] Path to backend (pie) project: ')
        ).trim()
        if (!raw) return null
        const expanded = raw.startsWith('~')
            ? path.join(process.env.HOME || '', raw.slice(1).replace(/^[\\/]/, ''))
            : raw
        const absolute = path.resolve(expanded)
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
            console.error(`[pieui] Not a directory: ${absolute}`)
            return null
        }
        config.backendProjectDir = absolute
        writeConfig(cwd, config)
        console.log(
            `[pieui] Saved backendProjectDir → ${configPathFor(cwd)}`
        )
        return absolute
    } finally {
        rl.close()
    }
}

/** Merge `extra` keys into `<targetDir>/.pie/config.json`, preserving
 *  existing keys not present in `extra`. */
export const mergeConfig = (targetDir: string, extra: PieConfig): void => {
    const existing = readConfig(targetDir)
    writeConfig(targetDir, { ...existing, ...extra })
}
