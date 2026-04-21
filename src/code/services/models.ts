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
