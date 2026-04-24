export type ComponentObject = {
    key: string
    size?: number
    contentType?: string
    signedUrl?: string
}

export type LanguageObjectGroup = {
    objects?: ComponentObject[]
}

export type ComponentTree = {
    prefix: string
    typescript?: LanguageObjectGroup
} & Record<string, unknown>

export type ProjectComponentEntry = { name: string }

export type ProjectComponentList = {
    userId: string
    project: string
    components: ProjectComponentEntry[]
}

export type ComponentRevisionSummary = {
    revision: number
    createdAt: string
    mutation: string
    deleted: boolean
}

export type ComponentRevisionList = {
    userId: string
    project: string
    componentName: string
    revisions: ComponentRevisionSummary[]
}

export const parseComponentRevisionList = (
    raw: unknown
): ComponentRevisionList => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const userId =
        typeof obj.user_id === 'string'
            ? obj.user_id
            : typeof obj.userId === 'string'
              ? obj.userId
              : ''
    const project =
        typeof obj.project_slug === 'string'
            ? obj.project_slug
            : typeof obj.projectSlug === 'string'
              ? obj.projectSlug
              : ''
    const componentName =
        typeof obj.component_name === 'string'
            ? obj.component_name
            : typeof obj.componentName === 'string'
              ? obj.componentName
              : ''
    const rawRevisions = Array.isArray(obj.revisions) ? obj.revisions : []
    const revisions: ComponentRevisionSummary[] = rawRevisions
        .map((entry) => {
            const e = (entry ?? {}) as Record<string, unknown>
            if (typeof e.revision !== 'number') return null
            const createdAt =
                typeof e.created_at === 'string'
                    ? e.created_at
                    : typeof e.createdAt === 'string'
                      ? e.createdAt
                      : ''
            return {
                revision: e.revision,
                createdAt,
                mutation: typeof e.mutation === 'string' ? e.mutation : '',
                deleted: e.deleted === true,
            }
        })
        .filter((e): e is ComponentRevisionSummary => e !== null)
    return { userId, project, componentName, revisions }
}

export const parseComponentObject = (raw: unknown): ComponentObject => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const key = typeof obj.key === 'string' ? obj.key : ''
    return {
        key,
        size: typeof obj.size === 'number' ? obj.size : undefined,
        contentType:
            typeof obj.content_type === 'string'
                ? obj.content_type
                : typeof obj.contentType === 'string'
                  ? obj.contentType
                  : undefined,
        signedUrl:
            typeof obj.signed_url === 'string'
                ? obj.signed_url
                : typeof obj.signedUrl === 'string'
                  ? obj.signedUrl
                  : undefined,
    }
}

export type HistoryFileStatus = 'added' | 'modified' | 'deleted'

export type HistoryFileEntry = {
    key: string
    status: HistoryFileStatus
    isBinary: boolean
    additions: number
    deletions: number
    patch?: string
}

export type HistoryEntry = {
    revision: number
    previousRevision: number | null
    createdAt: string
    mutation: string
    deleted: boolean
    files: HistoryFileEntry[]
}

export type ComponentHistory = {
    userId: string
    project: string
    componentName: string
    page: number
    perPage: number
    totalRevisions: number
    fromRevision: number | null
    toRevision: number | null
    entries: HistoryEntry[]
}

const pickString = (
    obj: Record<string, unknown>,
    ...keys: string[]
): string => {
    for (const k of keys) {
        const v = obj[k]
        if (typeof v === 'string') return v
    }
    return ''
}

const pickNumber = (
    obj: Record<string, unknown>,
    ...keys: string[]
): number | null => {
    for (const k of keys) {
        const v = obj[k]
        if (typeof v === 'number') return v
    }
    return null
}

const parseHistoryFile = (raw: unknown): HistoryFileEntry | null => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const key = typeof obj.key === 'string' ? obj.key : ''
    const status = obj.status
    if (status !== 'added' && status !== 'modified' && status !== 'deleted') {
        return null
    }
    const additions = pickNumber(obj, 'additions') ?? 0
    const deletions = pickNumber(obj, 'deletions') ?? 0
    return {
        key,
        status,
        isBinary:
            obj.is_binary === true ||
            (obj as { isBinary?: unknown }).isBinary === true,
        additions,
        deletions,
        patch: typeof obj.patch === 'string' ? obj.patch : undefined,
    }
}

const parseHistoryEntry = (raw: unknown): HistoryEntry | null => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const revision = pickNumber(obj, 'revision')
    if (revision === null) return null
    const diff = (obj.diff ?? {}) as Record<string, unknown>
    const rawFiles = Array.isArray(diff.files) ? diff.files : []
    const files = rawFiles
        .map(parseHistoryFile)
        .filter((f): f is HistoryFileEntry => f !== null)
    return {
        revision,
        previousRevision: pickNumber(obj, 'previous_revision', 'previousRevision'),
        createdAt: pickString(obj, 'created_at', 'createdAt'),
        mutation: pickString(obj, 'mutation'),
        deleted: obj.deleted === true,
        files,
    }
}

export const parseComponentHistory = (raw: unknown): ComponentHistory => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const rawEntries = Array.isArray(obj.entries) ? obj.entries : []
    const entries = rawEntries
        .map(parseHistoryEntry)
        .filter((e): e is HistoryEntry => e !== null)
    return {
        userId: pickString(obj, 'user_id', 'userId'),
        project: pickString(obj, 'project_slug', 'projectSlug'),
        componentName: pickString(obj, 'component_name', 'componentName'),
        page: pickNumber(obj, 'page') ?? 1,
        perPage: pickNumber(obj, 'per_page', 'perPage') ?? 10,
        totalRevisions: pickNumber(obj, 'total_revisions', 'totalRevisions') ?? 0,
        fromRevision: pickNumber(obj, 'from_revision', 'fromRevision'),
        toRevision: pickNumber(obj, 'to_revision', 'toRevision'),
        entries,
    }
}

export const parseProjectComponentList = (
    raw: unknown
): ProjectComponentList => {
    const obj = (raw ?? {}) as Record<string, unknown>
    const userId =
        typeof obj.user_id === 'string'
            ? obj.user_id
            : typeof obj.userId === 'string'
              ? obj.userId
              : ''
    const project =
        typeof obj.project_slug === 'string'
            ? obj.project_slug
            : typeof obj.projectSlug === 'string'
              ? obj.projectSlug
              : ''
    const rawComponents = Array.isArray(obj.components) ? obj.components : []
    const components: ProjectComponentEntry[] = rawComponents
        .map((entry) => {
            const e = (entry ?? {}) as Record<string, unknown>
            return typeof e.name === 'string' ? { name: e.name } : null
        })
        .filter((e): e is ProjectComponentEntry => e !== null)
    return { userId, project, components }
}
