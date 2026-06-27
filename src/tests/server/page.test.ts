import { describe, expect, test } from 'bun:test'
import { AsyncPage } from '../../server/page'
import { UnionCard, HiddenCard } from '../../server/cards'

class P extends AsyncPage {
    constructor() {
        super()
        this.fields = new UnionCard({
            content: [new HiddenCard({ name: 'email' })],
        })
    }
    async getContent(ctx: Record<string, unknown>) {
        return this.fields!.fill(ctx)
    }
}

describe('AsyncPage', () => {
    test('getContent fills fields with ctx', async () => {
        const out = (await new P().getContent({ email: 'z' })) as {
            content: any[]
        }
        expect(out.content[0].data).toEqual({
            name: 'email',
            value: 'z',
        })
    })
    test('registerAjax stores a POST handler', () => {
        const p = new P()
        const fn = async () => ({ ok: true })
        p.registerAjax('/x', fn, 'POST')
        expect(p.ajaxPost['/x']).toBe(fn)
    })
})
