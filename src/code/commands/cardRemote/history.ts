import { loadSettings } from '../../services/settings'
import { PieStorageService, STORAGE_LANGUAGE } from '../../services/storage'
import type { HistoryEntry, HistoryFileEntry } from '../../services/models'

export type CardRemoteHistoryOptions = {
    componentName: string
    page?: number
    perPage?: number
    from?: number
    to?: number
}

const extractPath = (key: string, componentName: string): string => {
    const marker = `/${componentName}/${STORAGE_LANGUAGE}/`
    const idx = key.indexOf(marker)
    if (idx === -1) return key
    return key.slice(idx + marker.length)
}

const formatFileBlock = (
    file: HistoryFileEntry,
    componentName: string
): string[] => {
    const path = extractPath(file.key, componentName)
    const before = file.status === 'added' ? 'a//dev/null' : `a/${path}`
    const after = file.status === 'deleted' ? 'b//dev/null' : `b/${path}`
    const lines: string[] = []
    lines.push(`diff --git ${before} ${after}`)
    lines.push(
        `${file.status} +${file.additions} -${file.deletions} ${path}`
    )
    if (file.isBinary) {
        lines.push('Binary files differ')
    } else if (file.patch) {
        lines.push(file.patch.replace(/\n+$/, ''))
    }
    return lines
}

const formatRevisionBlock = (
    entry: HistoryEntry,
    componentName: string
): string[] => {
    const lines: string[] = []
    lines.push(`revision ${componentName}@${entry.revision}`)
    lines.push(`date ${entry.createdAt}`)
    lines.push(`mutation ${entry.mutation}`)
    if (entry.previousRevision !== null) {
        lines.push(`previous ${entry.previousRevision}`)
    }
    if (entry.deleted) {
        lines.push('deleted true')
    }
    for (const file of entry.files) {
        lines.push('')
        lines.push(...formatFileBlock(file, componentName))
    }
    return lines
}

export const cardRemoteHistoryCommand = async (
    options: CardRemoteHistoryOptions
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
    if (
        options.from !== undefined &&
        options.to !== undefined &&
        options.from > options.to
    ) {
        throw new Error('--from must be <= --to')
    }

    const service = new PieStorageService(settings)
    const history = await service.getHistory({
        componentName: options.componentName,
        page: options.page,
        perPage: options.perPage,
        from: options.from,
        to: options.to,
    })

    const output: string[] = []
    output.push(
        `component ${history.userId}/${history.project}/${history.componentName}`
    )
    output.push(
        `page ${history.page} per-page ${history.perPage} total-revisions ${history.totalRevisions}`
    )
    if (history.fromRevision !== null || history.toRevision !== null) {
        const from =
            history.fromRevision !== null ? String(history.fromRevision) : '*'
        const to =
            history.toRevision !== null ? String(history.toRevision) : '*'
        output.push(`range ${from}..${to}`)
    }

    for (const entry of history.entries) {
        output.push('')
        output.push(...formatRevisionBlock(entry, history.componentName))
    }

    console.log(output.join('\n'))
}
