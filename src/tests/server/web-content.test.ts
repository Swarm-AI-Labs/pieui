import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'
import { UnionCard, HiddenCard } from '../../server/cards'

class Home extends AsyncPage {
    constructor() {
        super()
        this.fields = new UnionCard([new HiddenCard('email')])
    }
    async getContent(ctx: Record<string, unknown>) {
        return this.fields!.fill(ctx)
    }
}

const web = new Web({ '': new Home(), home: '' }, { enableCors: true })
const server = web.getApp().listen(0)
const port = (server.address() as { port: number }).port
afterAll(() => server.close())

describe('GET /api/content', () => {
    test('returns the UIConfig for the root page with query merged', async () => {
        const res = await fetch(`http://localhost:${port}/api/content/?email=q`)
        const body = await res.json()
        expect(body.card).toBe('UnionCard')
        expect(body.content[0].data).toEqual({
            name: 'email',
            value: 'q',
            useSocketioSupport: false,
            useCentrifugeSupport: false,
            centrifugeChannel: null,
        })
    })

    test('follows a string alias', async () => {
        const res = await fetch(`http://localhost:${port}/api/content/home`)
        const body = await res.json()
        expect(body.card).toBe('UnionCard')
    })

    test('404 for an unknown page', async () => {
        const res = await fetch(`http://localhost:${port}/api/content/nope`)
        expect(res.status).toBe(404)
    })
})
