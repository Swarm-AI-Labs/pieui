// Minimal DOM shim for tests that need window/document
if (typeof globalThis.window === 'undefined') {
    ;(globalThis as any).window = globalThis
}
if (typeof globalThis.document === 'undefined') {
    // Minimal document shim
    const elements = new Map<string, any>()
    const head: any = {
        firstChild: null,
        appendChild(el: any) {},
        insertBefore(el: any, ref: any) {},
    }
    ;(globalThis as any).document = {
        head,
        createElement(tag: string) {
            const el: any = {
                tagName: tag.toUpperCase(),
                id: '',
                children: [],
                type: '',
                styleSheet: null,
                appendChild(child: any) {},
            }
            el.submit = () => {}
            return el
        },
        getElementById(id: string) {
            return elements.get(id) ?? null
        },
        getElementsByTagName(tag: string) {
            if (tag === 'head') return [head]
            return []
        },
        createTextNode(text: string) {
            return { textContent: text }
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
