import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'

const PULL_URL = 'https://api-pieui.swarm.ing/external/pull'
const API_KEY_ENV = 'PIEUI_EXTERNAL_API_KEY'

const ensureDir = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true })
}

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

    const url = `${PULL_URL}?component=${encodeURIComponent(componentName)}`
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

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    ensureDir(componentDir)

    console.log(`[pieui] Extracting into: piecomponents/${componentName}`)

    const entries = Object.values(zip.files)
    for (const entry of entries) {
        const rel = entry.name
        if (!rel) continue

        const outPath = safeJoin(componentDir, rel)
        if (entry.dir) {
            ensureDir(outPath)
            continue
        }

        ensureDir(path.dirname(outPath))
        const buf = await entry.async('uint8array')
        fs.writeFileSync(outPath, buf)
    }

    console.log(`[pieui] Pull completed: ${componentName}`)
}
