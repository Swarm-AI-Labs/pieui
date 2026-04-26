import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemotePrivateCommand = async (
    componentName: string
): Promise<void> => {
    const settings = loadSettings()
    if (!settings.userId) {
        throw new Error('user_id is required (set PIE_USER_ID in env or .env)')
    }
    if (!settings.project) {
        throw new Error(
            'project is required (set PIE_PROJECT or PIE_PROJECT_SLUG)'
        )
    }

    const service = new PieStorageService(settings)
    const state = await service.markComponentPrivate({ componentName })

    console.log(
        `[pieui] Marked private: ${state.componentName} (user=${state.userId} project=${state.project})`
    )
    console.log(`[pieui] is_public: ${state.isPublic}`)
}
