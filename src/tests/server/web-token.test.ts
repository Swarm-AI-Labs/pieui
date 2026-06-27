import { afterAll, describe, expect, test } from 'bun:test'
import jwt from 'jsonwebtoken'
import { Web } from '../../server/web'

const web = new Web(
    {},
    { useCentrifugeSupport: true, centrifugeHmacSecret: 'sek' }
)
const server = web.getApp().listen(0)
const port = (server.address() as { port: number }).port
afterAll(() => server.close())

describe('gen_token', () => {
    test('signs a JWT with sub and exp', async () => {
        const res = await fetch(
            `http://localhost:${port}/api/centrifuge/gen_token`
        )
        const { token } = await res.json()
        const decoded = jwt.verify(token, 'sek') as {
            sub: string
            exp: number
            iat: number
        }
        expect(typeof decoded.sub).toBe('string')
        expect(decoded.exp).toBeGreaterThan(decoded.iat)
    })

    test('support route returns a bare boolean per feature name', async () => {
        const sio = await fetch(`http://localhost:${port}/api/support/socketio`)
        expect(await sio.json()).toBe(false)
        const cf = await fetch(`http://localhost:${port}/api/support/centrifuge`)
        expect(await cf.json()).toBe(true)
    })
})
