import { describe, expect, test } from 'bun:test'
import { publishToCentrifuge } from '../../server/realtime'

describe('publishToCentrifuge', () => {
    test('POSTs channel+data with api key header', async () => {
        const calls: Array<{ url: string; init: any }> = []
        const fakeFetch = (async (url: string, init: any) => {
            calls.push({ url, init })
            return { ok: true, json: async () => ({}) }
        }) as unknown as typeof fetch
        await publishToCentrifuge(
            {
                url: 'http://cf:8000',
                apiKey: 'k',
                channel: 'pieupdate_x',
                data: { a: 1 },
            },
            fakeFetch
        )
        expect(calls[0].url).toBe('http://cf:8000/api/publish')
        expect(calls[0].init.headers['X-API-Key']).toBe('k')
        expect(JSON.parse(calls[0].init.body)).toEqual({
            channel: 'pieupdate_x',
            data: { a: 1 },
        })
    })
})
