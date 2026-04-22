export type CardRef = { componentName: string; revision?: number }

export const parseCardRef = (input: string): CardRef => {
    const atIndex = input.indexOf('@')
    if (atIndex === -1) return { componentName: input }
    const componentName = input.slice(0, atIndex)
    const revisionPart = input.slice(atIndex + 1)
    if (!revisionPart) {
        throw new Error(`missing revision after '@' in ${JSON.stringify(input)}`)
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
