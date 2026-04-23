import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'
import { parseCardRef } from './cardRef'

export const cardRemotePullCommand = async (cardRef: string): Promise<void> => {
    const ref = parseCardRef(cardRef)
    const { componentName, revision, isPublic } = ref
    const settings = loadSettings()

    const effectiveUserId = ref.userId ?? settings.userId
    if (!effectiveUserId) {
        throw new Error(
            'user_id is required (set PIE_USER_ID in env or .env; run `pieui login`)'
        )
    }
    const effectiveProject = isPublic
        ? undefined
        : (ref.project ?? settings.project)
    if (!isPublic && !effectiveProject) {
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
            revision,
            userId: effectiveUserId,
            project: effectiveProject,
            isPublic,
        })
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw error
    }

    const sourceLabel = isPublic
        ? `r/${effectiveUserId}/${componentName}`
        : ref.project
          ? `${effectiveProject}/${componentName}`
          : componentName
    const suffix = revision !== undefined ? `@${revision}` : ''

    if (downloaded.length === 0) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        const where = isPublic
            ? `user_id=${effectiveUserId} (public)`
            : `user_id=${effectiveUserId}, project=${effectiveProject}`
        throw new Error(
            `No typescript files found for remote component ${sourceLabel}${suffix} (${where})`
        )
    }

    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    fs.renameSync(tempDir, componentDir)

    console.log(`[pieui] Pulled card: ${sourceLabel}${suffix}`)
    for (const p of downloaded) {
        const relative = path.relative(tempDir, p)
        console.log(`[pieui] Path: ${path.join(componentDir, relative)}`)
    }
}
