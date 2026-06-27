import type { SocketIOEvent } from './types'

function camelCase(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function isCardRecord(v: unknown): v is Record<string, Card> {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
    const vals = Object.values(v)
    return vals.length > 0 && vals.every((x) => x instanceof Card)
}

/**
 * Base card. Mirrors pie's `Card` dataclass: `generate()` splits own properties
 * into `data` (scalars, camelCased) vs children (values that are `instanceof
 * Card`), producing the `{ ...children, card, data }` wire format the PieUI
 * frontend consumes.
 */
export class Card {
    /** Registered frontend component name; defaults to the class name. */
    card: string = this.constructor.name

    /** Serialise to the PieUI `{ ...children, card, data }` wire format. */
    generate(): Record<string, unknown> {
        const data: Record<string, unknown> = {}
        const children: Record<string, unknown> = {}
        for (const key of Object.keys(this)) {
            if (key === 'card') continue
            const value = (this as Record<string, unknown>)[key]
            const outKey = camelCase(key)
            if (value instanceof Card) {
                children[outKey] = value.generate()
            } else if (
                Array.isArray(value) &&
                value.length > 0 &&
                value.every((v) => v instanceof Card)
            ) {
                children[outKey] = (value as Card[]).map((v) => v.generate())
            } else if (isCardRecord(value)) {
                children[outKey] = Object.fromEntries(
                    Object.entries(value).map(([k, v]) => [
                        k,
                        (v as Card).generate(),
                    ])
                )
            } else {
                data[outKey] = value
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

    /** Build a realtime event named `pie{method}_{name}`. Mirrors pie create_event. */
    createEvent(method: string, data: Record<string, unknown> = {}): SocketIOEvent {
        const name = (this as Record<string, unknown>).name
        if (typeof name !== 'string') {
            throw new Error('Card.createEvent requires a string `name`')
        }
        const io =
            (this as Record<string, unknown>).useSocketioSupport ||
            (this as Record<string, unknown>).useCentrifugeSupport ||
            (this as Record<string, unknown>).useMittSupport
        if (!io) {
            throw new Error(
                'Card.createEvent requires an IO support flag enabled'
            )
        }
        return { name: `pie${method}_${name}`, data }
    }
}

/** Input-bearing card (form field). `parse` validates a raw submitted value. */
export class InputCard extends Card {
    parse(raw: unknown): unknown {
        return raw
    }
}
