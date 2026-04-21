import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemoteRemoveCommand = async (
    componentName: string
): Promise<void> => {
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error('user_id is required (set PIE_USER_ID in env or .env)')
    }
    if (!settings.project) {
        throw new Error(
            'project is required (set PIE_PROJECT or PIE_PROJECT_SLUG in env or .env)'
        )
    }

    const service = new PieStorageService(settings)
    await service.deleteComponent({ componentName })
    console.log(`[pieui] Removed remote component: ${componentName}`)
}
