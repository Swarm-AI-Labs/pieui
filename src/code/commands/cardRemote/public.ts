import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemotePublicCommand = async (
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
    const state = await service.markComponentPublic({ componentName })

    console.log(
        `[pieui] Marked public: ${state.componentName} (user=${state.userId} project=${state.project})`
    )
    console.log(`[pieui] is_public: ${state.isPublic}`)
    if (state.publicRegistryName) {
        console.log(
            `[pieui] Public registry name: ${state.publicRegistryName}`
        )
    }
    console.log(
        `[pieui] Public read URL: <api>/public-components/${state.userId}/${state.componentName}`
    )
}
