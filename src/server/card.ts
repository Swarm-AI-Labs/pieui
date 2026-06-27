import type { SocketIOEvent } from './types'

function isCardRecord(v: unknown): v is Record<string, Card> {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
    const vals = Object.values(v)
    return vals.length > 0 && vals.every((x) => x instanceof Card)
}

/**
 * Base card. A server card mirrors its frontend counterpart 1:1: parameterise
 * it with the component's `*Data` interface and pass those fields (plus any
 * child `Card`s) to the constructor — no per-card constructor needed.
 *
 * `generate()` splits own properties into `data` (scalars) vs children (values
 * that are `instanceof Card`). Field names are used verbatim — TS fields are
 * already camelCase, so no key transformation is applied.
 */
export class Card<D extends object = Record<string, never>> {
    /** Registered frontend component name; defaults to the class name. */
    card: string = this.constructor.name

    constructor(props?: Partial<D>) {
        if (props) Object.assign(this, props)
    }

    /** Serialise to the PieUI `{ ...children, card, data }` wire format. */
    generate(): Record<string, unknown> {
        const data: Record<string, unknown> = {}
        const children: Record<string, unknown> = {}
        for (const key of Object.keys(this)) {
            if (key === 'card') continue
            const value = (this as unknown as Record<string, unknown>)[key]
            if (value instanceof Card) {
                children[key] = value.generate()
            } else if (
                Array.isArray(value) &&
                value.length > 0 &&
                value.every((v) => v instanceof Card)
            ) {
                children[key] = (value as Card[]).map((v) => v.generate())
            } else if (isCardRecord(value)) {
                children[key] = Object.fromEntries(
                    Object.entries(value).map(([k, v]) => [
                        k,
                        (v as Card).generate(),
                    ])
                )
            } else {
                data[key] = value
            }
        }
        return { ...children, card: this.card, data }
    }

    /** Recursively collect named InputCard descendants (incl. self). */
    inputChildLoc(): Record<string, InputCard> {
        const acc: Record<string, InputCard> = {}
        const visit = (card: Card) => {
            const name = (card as unknown as Record<string, unknown>).name
            if (card instanceof InputCard && typeof name === 'string') {
                acc[name] = card
            }
            for (const key of Object.keys(card)) {
                const v = (card as unknown as Record<string, unknown>)[key]
                if (v instanceof Card) visit(v)
                else if (Array.isArray(v))
                    v.forEach((x) => x instanceof Card && visit(x))
                else if (v && typeof v === 'object')
                    Object.values(v).forEach(
                        (x) => x instanceof Card && visit(x)
                    )
            }
        }
        visit(this)
        return acc
    }

    /** Assign values to named input children by name, then generate. */
    fill(data: Record<string, unknown>): Record<string, unknown> {
        const loc = this.inputChildLoc()
        for (const [name, card] of Object.entries(loc)) {
            if (name in data) {
                ;(card as unknown as Record<string, unknown>).value = data[name]
            }
        }
        return this.generate()
    }

    /** Build a realtime event named `pie{method}_{name}`. */
    createEvent(
        method: string,
        data: Record<string, unknown> = {}
    ): SocketIOEvent {
        const name = (this as unknown as Record<string, unknown>).name
        if (typeof name !== 'string') {
            throw new Error('Card.createEvent requires a string `name`')
        }
        const self = this as unknown as Record<string, unknown>
        const io =
            self.useSocketioSupport ||
            self.useCentrifugeSupport ||
            self.useMittSupport
        if (!io) {
            throw new Error(
                'Card.createEvent requires an IO support flag enabled'
            )
        }
        return { name: `pie${method}_${name}`, data }
    }
}

/** Input-bearing card (form field). `parse` validates a raw submitted value. */
export class InputCard<
    D extends object = Record<string, never>,
> extends Card<D> {
    parse(raw: unknown): unknown {
        return raw
    }
}
