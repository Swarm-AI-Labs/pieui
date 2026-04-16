import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'

const PUSH_URL = 'https://api-pieui.swarm.ing/external/push'
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

const walkFiles = (
    rootDir: string,
    dir: string
): Array<{ abs: string; rel: string }> => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const out: Array<{ abs: string; rel: string }> = []

    for (const entry of entries) {
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            out.push(...walkFiles(rootDir, abs))
            continue
        }
        if (!entry.isFile()) continue
        const rel = path.relative(rootDir, abs).replaceAll(path.sep, '/')
        out.push({ abs, rel })
    }

    return out
}

export const pushCommand = async (componentName: string) => {
    const pieComponentsDir = path.join(process.cwd(), 'piecomponents')
    const componentDir = path.join(pieComponentsDir, componentName)
    const remoteName = `${getProjectName()}/${componentName}`

    if (!fs.existsSync(pieComponentsDir)) {
        console.error(
            '[pieui] Error: piecomponents directory not found. Run "pieui init" first.'
        )
        process.exit(1)
    }

    if (!fs.existsSync(componentDir)) {
        console.error(
            `[pieui] Error: Component directory not found: piecomponents/${componentName}`
        )
        process.exit(1)
    }

    console.log(
        `[pieui] Creating zip archive for: piecomponents/${componentName}`
    )

    const zip = new JSZip()
    const files = walkFiles(componentDir, componentDir)

    for (const file of files) {
        zip.file(file.rel, fs.readFileSync(file.abs))
    }

    const zipBytes = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    })

    const form = new FormData()
    form.set('component', remoteName)
    // JSZip types may surface Uint8Array<ArrayBufferLike> (incl. SharedArrayBuffer),
    // while File/Blob parts in lib.dom are ArrayBuffer-based. Copy to ArrayBuffer.
    const zipArrayBuffer = new ArrayBuffer(zipBytes.byteLength)
    new Uint8Array(zipArrayBuffer).set(zipBytes)

    const file = new File([zipArrayBuffer], `${componentName}.zip`, {
        type: 'application/zip',
    })
    form.set('file', file)

    const headers: Record<string, string> = {}
    const apiKey = process.env[API_KEY_ENV]
    if (apiKey) {
        headers['x-api-key'] = apiKey
    }

    console.log(`[pieui] Uploading to: ${PUSH_URL}`)
    console.log(`[pieui] Remote component name: ${remoteName}`)

    const res = await fetch(PUSH_URL, {
        method: 'POST',
        body: form,
        headers,
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
            `push failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`
        )
    }

    const text = await res.text().catch(() => '')
    console.log(
        `[pieui] Push completed: ${remoteName}${text ? `\n[pieui] ${text}` : ''}`
    )
}
