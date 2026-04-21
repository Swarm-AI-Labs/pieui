export type CardMetadata = {
    component: string
    input: false
    ajax: boolean
    io: boolean
}

const AJAX_FIELD_NAMES = ['pathname', 'depsNames', 'kwargs']
const IO_FIELD_NAMES = [
    'useSocketioSupport',
    'useCentrifugeSupport',
    'useMittSupport',
    'centrifugeChannel',
]

const containsIdentifier = (source: string, name: string): boolean => {
    const pattern = new RegExp(`\\b${name}\\b`)
    return pattern.test(source)
}

export const extractCardMetadata = (
    componentName: string,
    source: string | undefined
): CardMetadata => {
    if (!source) {
        return {
            component: componentName,
            input: false,
            ajax: false,
            io: false,
        }
    }
    return {
        component: componentName,
        input: false,
        ajax: AJAX_FIELD_NAMES.some((n) => containsIdentifier(source, n)),
        io: IO_FIELD_NAMES.some((n) => containsIdentifier(source, n)),
    }
}

export const serializeCardMetadata = (meta: CardMetadata): Uint8Array => {
    const entries = Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))
    const obj: Record<string, unknown> = {}
    for (const [k, v] of entries) obj[k] = v
    const text = JSON.stringify(obj) + '\n'
    return new TextEncoder().encode(text)
}
