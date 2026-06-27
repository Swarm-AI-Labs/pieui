import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'

class P extends AsyncPage {
    async process(data: Record<string, unknown>) {
        return data.ok === 'yes' ? '/done' : '/retry'
    }
}
const web = new Web({ form: new P() })
const server = web.getApp().listen(0)
const port = (server.address() as { port: number }).port
afterAll(() => server.close())

describe('POST /api/process', () => {
    test('returns a 303 redirect from process() string', async () => {
        const res = await fetch(`http://localhost:${port}/api/process/form`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'ok=yes',
            redirect: 'manual',
        })
        expect(res.status).toBe(303)
        expect(res.headers.get('location')).toBe('/done')
    })
})
