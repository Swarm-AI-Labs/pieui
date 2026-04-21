import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemotePullCommand = async (
    componentName: string
): Promise<void> => {
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error(
            'user_id is required (set PIE_USER_ID in env or .env; run `pieui login`)'
        )
    }
    if (!settings.project) {
        throw new Error(
            'project is required (set PIE_PROJECT or PIE_PROJECT_SLUG in env or .env)'
        )
    }

    const componentDir = path.join(settings.componentsDir, componentName)
    fs.mkdirSync(settings.componentsDir, { recursive: true })

    const tempDir = `${componentDir}.pieui-tmp-${process.pid}-${Date.now()}`
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.mkdirSync(tempDir, { recursive: true })

    const service = new PieStorageService(settings)
    let downloaded: string[]
    try {
        downloaded = await service.downloadComponentDirectory({
            componentName,
            targetDir: tempDir,
        })
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw error
    }

    if (downloaded.length === 0) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw new Error(
            `No typescript files found for remote component ${componentName} (user_id=${settings.userId}, project=${settings.project})`
        )
    }

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    fs.renameSync(tempDir, componentDir)

    console.log(`[pieui] Pulled card: ${componentName}`)
    for (const p of downloaded) {
        const relative = path.relative(tempDir, p)
        console.log(`[pieui] Path: ${path.join(componentDir, relative)}`)
    }
}
