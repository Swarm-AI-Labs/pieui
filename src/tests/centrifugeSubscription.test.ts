import { describe, expect, test } from 'bun:test'
import { getOrCreateSubscription } from '../util/centrifugeSubscription'

// Minimal fake mirroring the centrifuge-js API surface we use: getSubscription
// returns an existing sub or null, newSubscription throws if one already exists.
function fakeCentrifuge() {
    const registry = new Map<string, any>()
    return {
        getSubscription(channel: string) {
            return registry.get(channel) ?? null
        },
        newSubscription(channel: string, options?: any) {
            if (registry.get(channel)) {
                throw new Error(`already registered: ${channel}`)
            }
            const sub = { channel, options }
            registry.set(channel, sub)
            return sub
        },
    }
}

describe('getOrCreateSubscription', () => {
    test('creates a new subscription when none exists', () => {
        const c = fakeCentrifuge() as any
        const { subscription, createdHere } = getOrCreateSubscription(c, 'ch1', {
            recoverable: true,
        })
        expect(createdHere).toBe(true)
        expect(subscription.channel).toBe('ch1')
        expect((subscription as any).options).toEqual({ recoverable: true })
    })

    test('reuses the existing subscription without throwing', () => {
        const c = fakeCentrifuge() as any
        const first = getOrCreateSubscription(c, 'ch1', { recoverable: true })
        // Second call for the same channel must NOT call newSubscription (which
        // would throw) — it returns the existing one with createdHere=false.
        const second = getOrCreateSubscription(c, 'ch1', { recoverable: true })
        expect(second.createdHere).toBe(false)
        expect(second.subscription).toBe(first.subscription)
    })
})
