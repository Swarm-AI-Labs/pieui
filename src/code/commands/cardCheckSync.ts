import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import * as readline from 'node:readline/promises'

import { buildCardMetadata } from './cardDumpMetadata'
import {
    compareMetadata,
    formatFindings,
    type PieMetadataLike,
} from '../metadataCompare'

const PIE_CONFIG_DIR = '.pie'
const PIE_CONFIG_FILE = 'config.json'

type PieConfig = {
    backendProjectDir?: string
    backendComponentsDir?: string
    [key: string]: unknown
}

const readConfig = (cwd: string): PieConfig => {
    const configPath = path.join(cwd, PIE_CONFIG_DIR, PIE_CONFIG_FILE)
    if (!fs.existsSync(configPath)) return {}
    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as PieConfig)
            : {}
    } catch {
        return {}
    }
}

const writeConfig = (cwd: string, config: PieConfig): void => {
    const dir = path.join(cwd, PIE_CONFIG_DIR)
    fs.mkdirSync(dir, { recursive: true })
    const configPath = path.join(dir, PIE_CONFIG_FILE)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

const walkUpForPyproject = (start: string): string | null => {
    let dir = path.resolve(start)
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return dir
        dir = path.dirname(dir)
    }
    return null
}

const ensureBackendDir = async (cwd: string): Promise<string | null> => {
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
            `[pieui] Non-interactive shell — add "backendProjectDir" to ${path.join(cwd, PIE_CONFIG_DIR, PIE_CONFIG_FILE)}`
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
            `[pieui] Saved backendProjectDir → ${path.join(cwd, PIE_CONFIG_DIR, PIE_CONFIG_FILE)}`
        )
        return absolute
    } finally {
        rl.close()
    }
}

const findVenvPython = (project: string): string => {
    const override = process.env.PIEUI_CHECK_SYNC_PYTHON
    if (override) return override
    for (const sub of ['.venv', 'venv']) {
        const candidate = path.join(project, sub, 'bin', 'python')
        if (fs.existsSync(candidate)) return candidate
    }
    return 'python3'
}

const runPieDump = (
    backendDir: string,
    cardName: string
): PieMetadataLike | null => {
    const python = findVenvPython(backendDir)
    const envOverride: Record<string, string> = { ...process.env } as Record<
        string,
        string
    >
    const extra = process.env.PIEUI_CHECK_SYNC_PYTHONPATH
    if (extra) {
        const existing = envOverride.PYTHONPATH || ''
        envOverride.PYTHONPATH = existing ? `${extra}:${existing}` : extra
    }
    const result = spawnSync(
        python,
        ['-m', 'pie', 'card', 'dump-metadata', cardName],
        {
            cwd: backendDir,
            encoding: 'utf8',
            env: envOverride,
        }
    )
    if (result.error) {
        console.error(`[pieui] Failed to run python: ${result.error.message}`)
        return null
    }
    if (result.status !== 0) {
        console.error(
            `[pieui] pie dump-metadata failed (exit ${result.status})\n${result.stderr}`
        )
        return null
    }
    const text = result.stdout
    const start = text.indexOf('{')
    if (start < 0) {
        console.error(`[pieui] could not locate JSON in pie output:\n${text}`)
        return null
    }
    try {
        return JSON.parse(text.slice(start)) as PieMetadataLike
    } catch (e) {
        console.error(`[pieui] invalid JSON from pie: ${(e as Error).message}`)
        return null
    }
}

export const cardCheckSyncCommand = async (
    componentName: string
): Promise<number> => {
    const cwd = process.cwd()
    const backendDir = await ensureBackendDir(cwd)
    if (!backendDir) {
        console.error('[pieui] backend project path required to run check-sync')
        return 1
    }

    console.log(
        `[pieui] Comparing ${componentName} (TS) ↔ ${componentName} (Python in ${backendDir})`
    )

    const tsMeta = buildCardMetadata(componentName)
    const pyMeta = runPieDump(backendDir, componentName)
    if (!pyMeta) return 1

    const findings = compareMetadata(pyMeta, tsMeta as PieMetadataLike)
    console.log(formatFindings(componentName, findings))
    return findings.length === 0 ? 0 : 1
}
