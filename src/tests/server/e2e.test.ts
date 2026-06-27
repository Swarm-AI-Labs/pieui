import { afterAll, describe, expect, test } from 'bun:test'
import { Web, AsyncPage, UnionCard, HiddenCard } from '../../server'

class Home extends AsyncPage {
    constructor() {
        super(true)
        this.fields = new UnionCard([new HiddenCard('email')])
    }
    async getContent(ctx: Record<string, unknown>) {
        return this.fields!.fill(ctx)
    }
    async process(data: Record<string, unknown>) {
        return `/welcome?e=${data.email}`
    }
}
const web = new Web({ '': new Home() }, { enableCors: true })
const server = web.getApp().listen(0)
const port = (server.address() as { port: number }).port
afterAll(() => server.close())

describe('e2e: content + process', () => {
    test('content returns the full UIConfig tree', async () => {
        const r = await fetch(
            `http://localhost:${port}/api/content/?email=a@b.c`
        )
        expect(await r.json()).toEqual({
            card: 'UnionCard',
            data: { name: null },
            content: [
                {
                    card: 'HiddenCard',
                    data: {
                        name: 'email',
                        value: 'a@b.c',
                        useSocketioSupport: false,
                        useCentrifugeSupport: false,
                        centrifugeChannel: null,
                    },
                },
            ],
        })
    })

    test('process redirects 303', async () => {
        const r = await fetch(`http://localhost:${port}/api/process/`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email=z',
            redirect: 'manual',
        })
        expect(r.status).toBe(303)
        expect(r.headers.get('location')).toBe('/welcome?e=z')
    })
})
