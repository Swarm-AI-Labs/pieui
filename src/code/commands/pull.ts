import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'

const PULL_URL = 'https://api-pieui.swarm.ing/external/pull'
const API_KEY_ENV = 'PIEUI_EXTERNAL_API_KEY'
const PULL_URL_ENV = 'PIEUI_EXTERNAL_PULL_URL'

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

const ensureDir = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true })
}

const makeTempComponentDir = (componentDir: string) =>
    `${componentDir}.pieui-tmp-${process.pid}-${Date.now()}`

const safeJoin = (baseDir: string, relPath: string) => {
    const normalized = relPath.replaceAll('\\', '/')
    const target = path.resolve(baseDir, normalized)
    const base = path.resolve(baseDir)
    if (!target.startsWith(base + path.sep) && target !== base) {
        throw new Error(`unsafe path in archive: "${relPath}"`)
    }
    return target
}

export const pullCommand = async (componentName: string) => {
    const pieComponentsDir = path.join(process.cwd(), 'piecomponents')
    const componentDir = path.join(pieComponentsDir, componentName)
    const remoteName = `${getProjectName()}/${componentName}`

    if (!fs.existsSync(pieComponentsDir)) {
        console.error(
            '[pieui] Error: piecomponents directory not found. Run "pieui init" first.'
        )
        process.exit(1)
    }

    const headers: Record<string, string> = {}
    const apiKey = process.env[API_KEY_ENV]
    if (apiKey) {
        headers['x-api-key'] = apiKey
    }
    const pullUrl = process.env[PULL_URL_ENV] || PULL_URL

    const url = `${pullUrl}?component=${encodeURIComponent(remoteName)}`
    console.log(`[pieui] Downloading from: ${url}`)

    const res = await fetch(url, { method: 'GET', headers })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
            `pull failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`
        )
    }

    const zipBytes = new Uint8Array(await res.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBytes)

    const tempComponentDir = makeTempComponentDir(componentDir)
    fs.rmSync(tempComponentDir, { recursive: true, force: true })
    ensureDir(tempComponentDir)

    console.log(`[pieui] Extracting into: piecomponents/${componentName}`)

    try {
        const entries = Object.values(zip.files)
        for (const entry of entries) {
            const rel = entry.name
            if (!rel) continue

            const outPath = safeJoin(tempComponentDir, rel)
            if (entry.dir) {
                ensureDir(outPath)
                continue
            }

            ensureDir(path.dirname(outPath))
            const buf = await entry.async('uint8array')
            fs.writeFileSync(outPath, buf)
        }
    } catch (error) {
        fs.rmSync(tempComponentDir, { recursive: true, force: true })
        throw error
    }

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    fs.renameSync(tempComponentDir, componentDir)

    console.log(`[pieui] Pull completed: ${remoteName}`)
}
