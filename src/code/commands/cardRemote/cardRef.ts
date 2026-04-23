export type CardRef = {
    componentName: string
    revision?: number
    userId?: string
    project?: string
    isPublic?: boolean
}

const parseNameAndRevision = (
    namePart: string,
    raw: string
): { componentName: string; revision?: number } => {
    const atIndex = namePart.indexOf('@')
    if (atIndex === -1) return { componentName: namePart }
    const componentName = namePart.slice(0, atIndex)
    const revisionPart = namePart.slice(atIndex + 1)
    if (!componentName) {
        throw new Error(`missing component name in ${JSON.stringify(raw)}`)
    }
    if (!revisionPart) {
        throw new Error(`missing revision after '@' in ${JSON.stringify(raw)}`)
    }
    if (!/^\d+$/.test(revisionPart)) {
        throw new Error(
            `revision must be a positive integer, got ${JSON.stringify(revisionPart)}`
        )
    }
    const revision = Number(revisionPart)
    if (revision < 1) {
        throw new Error(`revision must be >= 1, got ${revision}`)
    }
    return { componentName, revision }
}

export const parseCardRef = (input: string): CardRef => {
    if (!input) {
        throw new Error('card ref must not be empty')
    }
    if (input.startsWith('r/')) {
        const rest = input.slice(2)
        const parts = rest.split('/')
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(
                `expected r/<user>/<Component>, got ${JSON.stringify(input)}`
            )
        }
        const [userId, namePart] = parts
        const { componentName, revision } = parseNameAndRevision(
            namePart,
            input
        )
        if (revision !== undefined) {
            throw new Error(
                'revision suffix is not supported for public refs (r/...)'
            )
        }
        return { componentName, userId, isPublic: true }
    }
    const parts = input.split('/')
    if (parts.length === 1) {
        return parseNameAndRevision(input, input)
    }
    if (parts.length === 2) {
        const [project, namePart] = parts
        if (!project || !namePart) {
            throw new Error(
                `expected <project>/<Component>, got ${JSON.stringify(input)}`
            )
        }
        const { componentName, revision } = parseNameAndRevision(
            namePart,
            input
        )
        return { componentName, revision, project }
    }
    throw new Error(
        `invalid card ref ${JSON.stringify(input)}: expected <Component>, <project>/<Component>, or r/<user>/<Component>`
    )
}
