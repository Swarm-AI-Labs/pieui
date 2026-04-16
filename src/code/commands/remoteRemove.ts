import fs from 'fs'
import path from 'path'

const REMOVE_URL = 'https://api-pieui.swarm.ing/external/remove'
const API_KEY_ENV = 'PIEUI_EXTERNAL_API_KEY'

const toProjectSlug = (raw: string): string => {
    const base = raw.trim().replace(/^@/, '').replaceAll('/', '-')
    const cleaned = base
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    return cleaned || 'project'
}

const getProjectName = (): string => {
    const pkgPath = path.join(process.cwd(), 'package.json')
    try {
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
                name?: string
            }
            if (pkg.name) {
                const name = pkg.name.includes('/')
                    ? pkg.name.split('/').pop() || pkg.name
                    : pkg.name
                return toProjectSlug(name)
            }
        }
    } catch {
        // ignore
    }
    return toProjectSlug(path.basename(process.cwd()))
}

export const remoteRemoveCommand = async (componentName: string) => {
    const remoteName = `${getProjectName()}/${componentName}`

    const headers: Record<string, string> = {}
    const apiKey = process.env[API_KEY_ENV]
    if (apiKey) {
        headers['x-api-key'] = apiKey
    }

    const url = `${REMOVE_URL}?component=${encodeURIComponent(remoteName)}`
    console.log(`[pieui] Removing from: ${url}`)

    const res = await fetch(url, { method: 'DELETE', headers })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
            `remote-remove failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`
        )
    }

    const text = await res.text().catch(() => '')
    console.log(
        `[pieui] Remote remove completed: ${remoteName}${text ? `\n[pieui] ${text}` : ''}`
    )
}
