import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'

class P extends AsyncPage {
    constructor() {
        super()
        this.registerAjax(
            '/sum',
            async (d) => ({ n: Number(d.a) + Number(d.b) }),
            'POST'
        )
        this.registerAjax('/echo', async (d) => ({ got: d.q }), 'GET')
    }
}
const web = new Web({ '': new P() })
const server = web.getApp().listen(0)
const port = (server.address() as { port: number }).port
afterAll(() => server.close())

describe('ajax_content', () => {
    test('POST routes to a registered handler', async () => {
        const res = await fetch(`http://localhost:${port}/api/ajax_content/sum`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'a=2&b=3',
        })
        expect(await res.json()).toEqual({ n: 5 })
    })
    test('GET routes to a registered handler with query', async () => {
        const res = await fetch(
            `http://localhost:${port}/api/ajax_content/echo?q=hi`
        )
        expect(await res.json()).toEqual({ got: 'hi' })
    })
})
