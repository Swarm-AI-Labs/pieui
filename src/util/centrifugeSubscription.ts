import type { Centrifuge, Subscription, SubscriptionOptions } from 'centrifuge'

/**
 * Returns the existing Centrifuge subscription for `channel`, or creates one if
 * none is registered yet. `centrifuge.newSubscription` throws if a subscription
 * for the channel already exists, so callers that may subscribe to the same
 * channel more than once (e.g. a card briefly mounted twice during a tree
 * rebuild) must dedupe via `getSubscription` first — this helper does that.
 *
 * `createdHere` is `true` when this call allocated the subscription, so the
 * caller knows it owns teardown (`unsubscribe` + `removeSubscription`); when a
 * subscription is reused, the caller should only remove its own listeners and
 * leave the subscription for its original owner.
 */
export function getOrCreateSubscription(
    centrifuge: Pick<Centrifuge, 'getSubscription' | 'newSubscription'>,
    channel: string,
    options?: Partial<SubscriptionOptions>
): { subscription: Subscription; createdHere: boolean } {
    const existing = centrifuge.getSubscription(channel)
    if (existing) {
        return { subscription: existing, createdHere: false }
    }
    return {
        subscription: centrifuge.newSubscription(channel, options),
        createdHere: true,
    }
}
