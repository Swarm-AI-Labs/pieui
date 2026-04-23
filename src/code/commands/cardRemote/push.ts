import fs from 'node:fs'
import path from 'node:path'
import { extractCardMetadata, serializeCardMetadata } from '../../cardMetadata'
import { loadSettings } from '../../services/settings'
import { PieStorageError, PieStorageService } from '../../services/storage'
import { parseCardRef } from './cardRef'

export const cardRemotePushCommand = async (
    cardRef: string
): Promise<void> => {
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

    const service = new PieStorageService(settings)

    const uploaded = await service.uploadComponentDirectory({
        componentName,
        sourceDir: componentDir,
    })
    if (uploaded.length === 0) {
        throw new Error(`No files uploaded for component: ${componentName}`)
    }

    const typesPath = path.join(componentDir, 'types', 'index.ts')
    const typesSource = fs.existsSync(typesPath)
        ? fs.readFileSync(typesPath, 'utf8')
        : undefined
    const metadata = extractCardMetadata(componentName, typesSource)
    const metadataResult = await service.uploadMetadataContent({
        componentName,
        schemaKind: 'eventSchema',
        content: serializeCardMetadata(metadata),
    })

    const latestRevision = await latestRevisionNumber(service, componentName)

    console.log(`[pieui] Uploaded card: ${componentName}`)
    console.log(`[pieui] Path: ${componentDir}`)
    console.log(`[pieui] Files uploaded: ${uploaded.length}`)
    console.log(`[pieui] Metadata key: ${metadataResult.key}`)
    if (latestRevision !== undefined) {
        console.log(`[pieui] Revision: ${componentName}@${latestRevision}`)
    }
    console.log(
        `[pieui] Metadata: Input=${metadata.input ? 'Yes' : 'No'}, ` +
            `Ajax=${metadata.ajax ? 'Yes' : 'No'}, IO=${metadata.io ? 'Yes' : 'No'}`
    )
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
