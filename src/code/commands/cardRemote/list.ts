import { loadSettings } from '../../services/settings'
import { PieStorageService } from '../../services/storage'

export const cardRemoteListCommand = async (options: {
    userId?: string
    project?: string
}): Promise<void> => {
    const settings = loadSettings()
    const userId = options.userId || settings.userId
    const project = options.project || settings.project
    if (!userId) {
        throw new Error(
            'user_id is required (use --user or set PIE_USER_ID in env or .env)'
        )
    }
    if (!project) {
        throw new Error(
            'project is required (use --project or set PIE_PROJECT / PIE_PROJECT_SLUG)'
        )
    }

    const service = new PieStorageService(settings)
    const result = await service.listProjectComponents({ userId, project })
    console.log(
        `[pieui] Remote components for user_id=${JSON.stringify(result.userId)} project_slug=${JSON.stringify(result.project)}:`
    )
    for (const entry of [...result.components].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    )) {
        console.log(entry.name)
    }
}
