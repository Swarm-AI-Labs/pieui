import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'
import { restoreComponentFromEnvelope } from '../../services/dumpEnvelope'
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

    const sourceLabel = isPublic
        ? `r/${effectiveUserId}/${componentName}`
        : ref.project
          ? `${effectiveProject}/${componentName}`
          : componentName
    const suffix = revision !== undefined ? `@${revision}` : ''

    const service = new PieStorageService(settings)
    fs.mkdirSync(settings.componentsDir, { recursive: true })

    if (isPublic) {
        await pullPublicViaTree(service, settings.componentsDir, {
            componentName,
            userId: effectiveUserId,
        })
        const componentDir = path.join(settings.componentsDir, componentName)
        console.log(`[pieui] Pulled card: ${sourceLabel}${suffix}`)
        for (const p of walkFiles(componentDir)) {
            console.log(`[pieui] Path: ${p}`)
        }
        return
    }

    const envelope = await service.fetchEnvelope({
        componentName,
        userId: effectiveUserId,
        project: effectiveProject,
        revision,
    })
    const { written } = restoreComponentFromEnvelope(
        envelope,
        `${sourceLabel}${suffix}`
    )

    console.log(`[pieui] Pulled card: ${sourceLabel}${suffix}`)
    for (const p of written) console.log(`[pieui] Path: ${p}`)
}

const pullPublicViaTree = async (
    service: PieStorageService,
    componentsDir: string,
    args: { componentName: string; userId: string }
): Promise<void> => {
    const componentDir = path.join(componentsDir, args.componentName)
    const tempDir = `${componentDir}.pieui-tmp-${process.pid}-${Date.now()}`
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.mkdirSync(tempDir, { recursive: true })
    let downloaded: string[]
    try {
        downloaded = await service.downloadComponentDirectory({
            componentName: args.componentName,
            targetDir: tempDir,
            userId: args.userId,
            isPublic: true,
        })
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw error
    }
    if (downloaded.length === 0) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw new Error(
            `No typescript files found for remote component r/${args.userId}/${args.componentName} ` +
                `(user_id=${args.userId} (public))`
        )
    }
    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
    }
    fs.renameSync(tempDir, componentDir)
}

const walkFiles = (dir: string): string[] => {
    const out: string[] = []
    if (!fs.existsSync(dir)) return out
    const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const abs = path.join(d, entry.name)
            if (entry.isDirectory()) walk(abs)
            else if (entry.isFile()) out.push(abs)
        }
    }
    walk(dir)
    out.sort()
    return out
}
