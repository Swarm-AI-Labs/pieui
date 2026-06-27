import { Card } from './card'
import type { SocketIOEvent } from './types'
import type { Publisher } from './realtime'

type AjaxFn = (data: Record<string, unknown>) => Promise<unknown>

/**
 * Base page. Mirrors pie's AsyncPage: holds a `fields` card tree and exposes
 * `getContent`/`process`/`registerAjax`/`emit`.
 */
export class AsyncPage {
    fields?: Card
    isTyped: boolean
    ajaxPost: Record<string, AjaxFn> = {}
    ajaxGet: Record<string, AjaxFn> = {}
    private publisher?: Publisher

    constructor(isTyped = false) {
        this.isTyped = isTyped
    }

    /** Return the filled UIConfig. Default fills `fields` with `{}`; override to use ctx. */
    async getContent(
        _ctx: Record<string, unknown> = {}
    ): Promise<Record<string, unknown>> {
        if (this.fields) return this.fields.fill({})
        throw new Error('getContent not implemented and no `fields` set')
    }

    /** Handle a form submission. Return a string URL (→303 redirect). */
    async process(_data: Record<string, unknown>): Promise<string | unknown> {
        throw new Error('process not implemented')
    }

    registerAjax(
        pathname: string,
        fn: AjaxFn,
        method: 'POST' | 'GET' = 'POST'
    ): void {
        if (method === 'POST') this.ajaxPost[pathname] = fn
        else this.ajaxGet[pathname] = fn
    }

    /** Injected by Web to route emitted events to the configured transport. */
    setPublisher(p: Publisher): void {
        this.publisher = p
    }

    async emit(
        event: SocketIOEvent | SocketIOEvent[],
        to?: string
    ): Promise<void> {
        if (!this.publisher) {
            throw new Error('no publisher configured (Web must call setPublisher)')
        }
        const events = Array.isArray(event) ? event : [event]
        for (const ev of events) await this.publisher(ev, to)
    }
}
