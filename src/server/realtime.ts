import type { SocketIOEvent } from './types'

type FetchFn = typeof fetch

/** Publish a payload to a Centrifugo channel via its HTTP API. Mirrors pie publish. */
export async function publishToCentrifuge(
    opts: { url: string; apiKey: string; channel: string; data: unknown },
    fetchFn: FetchFn = fetch
): Promise<void> {
    const res = await fetchFn(`${opts.url.replace(/\/$/, '')}/api/publish`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': opts.apiKey,
        },
        body: JSON.stringify({ channel: opts.channel, data: opts.data }),
    })
    if (!res.ok) {
        throw new Error(`centrifuge publish failed: ${res.status}`)
    }
}

/** Publishes a single event, optionally scoped to a subscriber id `to`. */
export type Publisher = (event: SocketIOEvent, to?: string) => Promise<void>
