import { Card, InputCard } from '../card'

/** Single hidden input field. Mirrors pie HiddenCard. */
export class HiddenCard extends InputCard {
    useSocketioSupport = false
    useCentrifugeSupport = false
    centrifugeChannel: string | null = null
    constructor(
        public name: string,
        public value: unknown = null
    ) {
        super()
    }
}

/** Generic container of child cards. Mirrors pie UnionCard. */
export class UnionCard extends Card {
    constructor(
        public content: Card[],
        public name: string | null = null
    ) {
        super()
    }
}

/** AJAX-enabled container (single child). Mirrors pie AjaxGroupCard. */
export class AjaxGroupCard extends Card {
    useLoader = true
    noReturn = false
    returnType: 'content' | 'events' = 'content'
    useSocketioSupport = false
    useCentrifugeSupport = false
    centrifugeChannel: string | null = null
    constructor(
        public content: Card,
        public name = ''
    ) {
        super()
    }
}

/** One-of-N alternative container. Mirrors pie OneOfCard. */
export class OneOfCard extends Card {
    constructor(
        public content: Card[],
        public name: string | null = null
    ) {
        super()
    }
}

/** Raw HTML injection. Mirrors pie HTMLEmbedCard. */
export class HTMLEmbedCard extends Card {
    constructor(
        public html: string,
        public name: string | null = null
    ) {
        super()
    }
}

/** Realtime-only card carrying IO support flags. Mirrors pie IOCard. */
export class IOCard extends Card {
    useSocketioSupport = false
    useCentrifugeSupport = false
    useMittSupport = false
    centrifugeChannel: string | null = null
    constructor(
        public name: string,
        opts: Partial<
            Pick<
                IOCard,
                | 'useSocketioSupport'
                | 'useCentrifugeSupport'
                | 'useMittSupport'
                | 'centrifugeChannel'
            >
        > = {}
    ) {
        super()
        Object.assign(this, opts)
    }
}
