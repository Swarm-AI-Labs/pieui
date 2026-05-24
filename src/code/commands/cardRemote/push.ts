import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../../services/settings'
import { PieStorageError, PieStorageService } from '../../services/storage'
import { buildCardMetadata } from '../cardDumpMetadata'
import { parseCardRef } from './cardRef'

export const cardRemotePushCommand = async (cardRef: string): Promise<void> => {
    const ref = parseCardRef(cardRef)
    if (ref.revision !== undefined) {
        throw new Error('push does not accept a revision suffix')
    }
    if (ref.isPublic) {
        throw new Error('push does not accept public refs (r/...)')
    }
    if (ref.project || ref.userId) {
        throw new Error(
            'push does not accept project/user override; pass just <ComponentName>'
        )
    }
    const { componentName } = ref
    if (!/^[A-Z][A-Za-z0-9]+$/.test(componentName)) {
        throw new Error(
            'Component name must start with uppercase letter and contain only letters and numbers'
        )
    }
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error(
            'user_id is required (set PIE_USER_ID in env or .env; run `pieui login`)'
        )
    }

    const componentDir = path.join(settings.componentsDir, componentName)
    if (
        !fs.existsSync(componentDir) ||
        !fs.statSync(componentDir).isDirectory()
    ) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const meta = buildCardMetadata(componentName)
    const service = new PieStorageService(settings)
    await service.pushEnvelope({
        componentName,
        body: { typescript: meta },
    })

    const latestRevision = await latestRevisionNumber(service, componentName)

    console.log(`[pieui] Uploaded card: ${componentName}`)
    console.log(`[pieui] Path: ${componentDir}`)
    console.log(`[pieui] Files: ${meta.files.length}`)
    if (latestRevision !== undefined) {
        console.log(`[pieui] Revision: ${componentName}@${latestRevision}`)
    }
}

const latestRevisionNumber = async (
    service: PieStorageService,
    componentName: string
): Promise<number | undefined> => {
    try {
        const list = await service.listRevisions({ componentName })
        if (list.revisions.length === 0) return undefined
        return list.revisions.reduce(
            (max, entry) => (entry.revision > max ? entry.revision : max),
            0
        )
    } catch (error) {
        if (error instanceof PieStorageError) return undefined
        throw error
    }
}
