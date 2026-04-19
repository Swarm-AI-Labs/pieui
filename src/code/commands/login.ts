import { execFile } from 'node:child_process'
import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const CONNECT_BASE = 'https://pieui.swarm.ing/connect'
export const CREDENTIALS_API =
    'https://api-pieui.swarm.ing/api/external/credentials'

const CODE_LENGTH = 32

const generateCode = (length: number = CODE_LENGTH): string => {
    const alphabet =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let out = ''
    for (let i = 0; i < length; i++) {
        out += alphabet[randomInt(alphabet.length)]!
    }
    return out
}

const tryOpenBrowser = (url: string): void => {
    try {
        if (process.platform === 'win32') {
            execFile('cmd', ['/c', 'start', '', url], () => {})
        } else if (process.platform === 'darwin') {
            execFile('open', [url], () => {})
        } else {
            execFile('xdg-open', [url], () => {})
        }
    } catch {
        // same as Python webbrowser.open failure: ignore
    }
}

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

const PIE_ENV_MAP = [
    ['PIE_USER_ID', 'user_id'],
    ['PIE_PROJECT', 'project'],
    ['PIE_API_KEY', 'api_key'],
] as const

const formatEnvValue = (val: string): string => {
    if (/[\s#'"\\]/.test(val) || val === '') {
        return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return val
}

const appendPieCredentialsToEnv = (cwd: string, config: unknown): void => {
    if (typeof config !== 'object' || config === null) {
        return
    }
    const c = config as Record<string, unknown>
    const entries: Record<string, string> = {}
    for (const [envKey, jsonKey] of PIE_ENV_MAP) {
        const v = c[jsonKey]
        if (v !== undefined && v !== null) {
            entries[envKey] = String(v)
        }
    }
    if (Object.keys(entries).length === 0) {
        return
    }

    const envPath = path.join(cwd, '.env')
    let content = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, 'utf8')
        : ''
    if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n'
    }
    const additions = PIE_ENV_MAP.filter(([envKey]) => envKey in entries).map(
        ([envKey]) => `${envKey}=${formatEnvValue(entries[envKey]!)}`
    )
    content += `${additions.join('\n')}\n`
    fs.writeFileSync(envPath, content, 'utf8')
    console.log(`[pie] Appended credentials to ${envPath}`)
}

export type LoginCommandOptions = {
    cwd?: string
    pollIntervalMs?: number
    openBrowser?: (url: string) => void
    fetchImpl?: typeof fetch
    sleepImpl?: (ms: number) => Promise<void>
}

export async function loginCommand(
    options: LoginCommandOptions = {}
): Promise<void> {
    const {
        cwd = process.cwd(),
        pollIntervalMs = 3000,
        openBrowser = tryOpenBrowser,
        fetchImpl = fetch,
        sleepImpl = defaultSleep,
    } = options

    const code = generateCode(CODE_LENGTH)
    const connectUrl = `${CONNECT_BASE}?${new URLSearchParams({ code }).toString()}`

    console.log('Open link in browser:\n')
    console.log(connectUrl)

    try {
        openBrowser(connectUrl)
    } catch {
        // ignore
    }

    const pieDir = path.join(cwd, '.pie')
    const configPath = path.join(pieDir, 'config.json')

    const url = `${CREDENTIALS_API}?${new URLSearchParams({ code }).toString()}`
    let first = true

    while (true) {
        if (!first) {
            await sleepImpl(pollIntervalMs)
        }
        first = false

        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), 30_000)
        let response: Response
        try {
            response = await fetchImpl(url, { signal: ac.signal })
        } finally {
            clearTimeout(timer)
        }

        if (!response.ok) {
            throw new Error(
                `[pieui] Login poll failed: HTTP ${response.status} ${response.statusText}`
            )
        }

        const data: unknown = await response.json()
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            continue
        }

        const record = data as Record<string, unknown>
        const status = record.status

        if (status === 'error') {
            const detail =
                (typeof record.message === 'string' && record.message) ||
                (typeof record.error === 'string' && record.error) ||
                'unknown error'
            throw new Error(`Login failed: ${detail}`)
        }

        if (status === 'ok') {
            if (!('config' in record)) {
                throw new Error(
                    "Login succeeded but response had no 'config' field"
                )
            }
            fs.mkdirSync(pieDir, { recursive: true })
            fs.writeFileSync(
                configPath,
                `${JSON.stringify(record.config, null, 2)}\n`,
                'utf8'
            )
            console.log(`[pie] Saved credentials to ${configPath}`)
            appendPieCredentialsToEnv(cwd, record.config)
            return
        }
    }
}
