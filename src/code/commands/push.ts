import fs from 'fs'
import path from 'path'
import {
    formatRemoteName,
    getComponentApiUrl,
    getStorageConfig,
    getStorageHeaders,
    responseError,
} from '../storageApi'

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

    const config = getStorageConfig()
    const componentUrl = getComponentApiUrl(config, componentName)
    const remoteName = formatRemoteName(config, componentName)
    const headers = getStorageHeaders(config)
    const files = walkFiles(componentDir, componentDir)

    console.log(`[pieui] Remote component name: ${remoteName}`)
    console.log(`[pieui] Files to upload: ${files.length}`)

    const languageUrl = `${componentUrl}/typescript`
    console.log(
        `[pieui] Removing existing remote TypeScript files: ${languageUrl}`
    )
    const deleteResponse = await fetch(languageUrl, {
        method: 'DELETE',
        headers,
    })
    if (!deleteResponse.ok) {
        throw await responseError('remote TypeScript cleanup', deleteResponse)
    }

    if (files.length === 0) {
        console.log(`[pieui] Push completed: ${remoteName} (empty component)`)
        return
    }

    const form = new FormData()
    for (const file of files) {
        form.append('object_paths', file.rel)
    }
    for (const file of files) {
        const bytes = fs.readFileSync(file.abs)
        const blob = new Blob([bytes], { type: 'application/octet-stream' })
        form.append('files', blob, path.basename(file.rel))
    }

    const uploadUrl = `${componentUrl}/batch/typescript`
    console.log(`[pieui] Uploading to: ${uploadUrl}`)

    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: form,
        headers,
    })

    if (!uploadResponse.ok) {
        throw await responseError('push', uploadResponse)
    }

    const body = await uploadResponse.json().catch(() => null)
    const uploadedCount = Array.isArray(body?.objects)
        ? body.objects.length
        : files.length
    console.log(`[pieui] Push completed: ${remoteName} (${uploadedCount} files)`)
}
