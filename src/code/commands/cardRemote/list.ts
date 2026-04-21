import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemoteListCommand = async (options: {
    userId?: string
    projectSlug?: string
}): Promise<void> => {
    const settings = loadSettings()
    const userId = options.userId || settings.userId
    const projectSlug = options.projectSlug || settings.project
    if (!userId) {
        throw new Error(
            'user_id is required (use --user or set PIE_USER_ID in env or .env)'
        )
    }
    if (!projectSlug) {
        throw new Error(
            'project is required (use --project or set PIE_PROJECT / PIE_PROJECT_SLUG)'
        )
    }

    const service = new PieStorageService(settings)
    const result = await service.listProjectComponents({ userId, projectSlug })
    console.log(
        `[pieui] Remote components for user_id=${JSON.stringify(result.userId)} project_slug=${JSON.stringify(result.projectSlug)}:`
    )
    for (const entry of [...result.components].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    )) {
        console.log(entry.name)
    }
}
