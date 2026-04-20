import fs from 'fs'
import path from 'path'
import type { ComponentTree } from '../storageApi'
import {
    encodeObjectPath,
    formatRemoteName,
    getComponentApiUrl,
    getStorageConfig,
    getStorageHeaders,
    responseError,
} from '../storageApi'

const ensureDir = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true })
}

const safeJoin = (baseDir: string, relPath: string) => {
    const normalized = relPath.replaceAll('\\', '/')
    const target = path.resolve(baseDir, normalized)
    const base = path.resolve(baseDir)
    if (!target.startsWith(base + path.sep) && target !== base) {
        throw new Error(`unsafe path in remote component: "${relPath}"`)
    }
    return target
}

const relativeObjectPath = (key: string, prefix: string): string | null => {
    if (!key.startsWith(prefix)) {
        return null
    }
    const rel = key.slice(prefix.length)
    return rel || null
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

    const config = getStorageConfig()
    const componentUrl = getComponentApiUrl(config, componentName)
    const remoteName = formatRemoteName(config, componentName)
    const headers = getStorageHeaders(config)

    console.log(`[pieui] Reading component tree: ${componentUrl}`)
    const treeResponse = await fetch(componentUrl, { method: 'GET', headers })
    if (!treeResponse.ok) {
        throw await responseError('pull tree', treeResponse)
    }

    const tree = (await treeResponse.json()) as ComponentTree
    const prefix = `${tree.prefix}typescript/`
    const objects = tree.typescript?.objects || []
    const files = objects
        .map((object) => relativeObjectPath(object.key, prefix))
        .filter((value): value is string => Boolean(value))

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    ensureDir(componentDir)

    console.log(
        `[pieui] Downloading ${files.length} files into: piecomponents/${componentName}`
    )

    for (const relPath of files) {
        const fileUrl = `${componentUrl}/typescript/${encodeObjectPath(relPath)}`
        const fileResponse = await fetch(fileUrl, { method: 'GET', headers })
        if (!fileResponse.ok) {
            throw await responseError(`pull file ${relPath}`, fileResponse)
        }

        const outPath = safeJoin(componentDir, relPath)
        ensureDir(path.dirname(outPath))
        const bytes = new Uint8Array(await fileResponse.arrayBuffer())
        fs.writeFileSync(outPath, bytes)
    }

    console.log(`[pieui] Pull completed: ${remoteName} (${files.length} files)`)
}
