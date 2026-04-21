import fs from 'node:fs'
import path from 'node:path'

export const parseDotenv = (content: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        if (!key) continue
        let value = line.slice(eq + 1).trim()
        if (
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1)
        }
        out[key] = value
    }
    return out
}

export type Settings = {
    userId?: string
    apiKey?: string
    project: string
    componentsDir: string
    apiBaseUrl: string
}

const DEFAULT_API_BASE_URL = 'https://cdn-pieui.swarm.ing/api'

const readDotenv = (cwd: string): Record<string, string> => {
    const envPath = path.join(cwd, '.env')
    if (!fs.existsSync(envPath)) return {}
    try {
        return parseDotenv(fs.readFileSync(envPath, 'utf8'))
    } catch {
        return {}
    }
}

export const loadSettings = (cwd: string = process.cwd()): Settings => {
    const dotenv = readDotenv(cwd)
    const pick = (key: string): string | undefined =>
        process.env[key] !== undefined && process.env[key] !== ''
            ? process.env[key]
            : dotenv[key]

    const userId = pick('PIE_USER_ID')
    const apiKey = pick('PIE_API_KEY')
    const project =
        pick('PIE_PROJECT') || pick('PIE_PROJECT_SLUG') || path.basename(cwd)
    const componentsDirRaw = pick('PIE_COMPONENTS_DIR') || 'piecomponents'
    const componentsDir = path.isAbsolute(componentsDirRaw)
        ? componentsDirRaw
        : path.join(cwd, componentsDirRaw)
    const apiBaseUrl = (pick('PIE_API_BASE_URL') || DEFAULT_API_BASE_URL).replace(
        /\/+$/,
        ''
    )

    return {
        userId,
        apiKey,
        project,
        componentsDir,
        apiBaseUrl,
    }
}
