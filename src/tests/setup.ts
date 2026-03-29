// Minimal DOM shim for tests that need window/document
if (typeof globalThis.window === 'undefined') {
    ;(globalThis as any).window = globalThis
}
if (typeof globalThis.document === 'undefined') {
    // Minimal document shim
    const elements = new Map<string, any>()
    ;(globalThis as any).document = {
        createElement(tag: string) {
            const el: any = { tagName: tag.toUpperCase(), id: '', children: [] }
            el.submit = () => {}
            return el
        },
        getElementById(id: string) {
            return elements.get(id) ?? null
        },
        body: {
            appendChild(el: any) {
                if (el.id) elements.set(el.id, el)
            },
            removeChild(el: any) {
                if (el.id) elements.delete(el.id)
            },
        },
    }
}