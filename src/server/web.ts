import express, {
    type Express,
    type Request,
    type Response,
    type NextFunction,
} from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
import { AsyncPage } from './page'
import { form2dict, aggregate } from './form'
import { publishToCentrifuge } from './realtime'
import type { WebOptions } from './types'

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Assembles an Express app mirroring the pie FastAPI runtime: routes for
 * content, process, ajax, support, and centrifuge token, plus realtime
 * publishing wired into every page.
 */
export class Web {
    pages: Record<string, AsyncPage | string>
    opts: WebOptions & { adminSubdomain: string }

    constructor(pages: Record<string, AsyncPage | string>, opts: WebOptions = {}) {
        this.pages = pages
        const adminSubdomain = opts.adminSubdomain ?? '/'
        if (!adminSubdomain.startsWith('/') || !adminSubdomain.endsWith('/')) {
            throw new Error('adminSubdomain must start and end with "/"')
        }
        this.opts = { ...opts, adminSubdomain }
        this.wirePublishers()
    }

    private wirePublishers(): void {
        if (
            !this.opts.useCentrifugeSupport ||
            !this.opts.centrifugeUrl ||
            !this.opts.centrifugeApiKey
        ) {
            return
        }
        for (const entry of Object.values(this.pages)) {
            if (typeof entry === 'string') continue
            entry.setPublisher(async (ev, to) => {
                const channel = to ? `${ev.name}_${to}` : ev.name
                await publishToCentrifuge({
                    url: this.opts.centrifugeUrl!,
                    apiKey: this.opts.centrifugeApiKey!,
                    channel,
                    data: ev.data,
                })
            })
        }
    }

    /** Resolve a pathname to a page, following string aliases. */
    resolvePage(pathname: string): AsyncPage | null {
        let key = pathname.replace(/^\/+/, '')
        let hops = 0
        while (hops++ < 10) {
            const entry = this.pages[key]
            if (entry === undefined) return null
            if (typeof entry === 'string') {
                key = entry
                continue
            }
            return entry
        }
        return null
    }

    private contextFromRequest(req: Request): Record<string, unknown> {
        const ctx: Record<string, unknown> = {}
        for (const k of this.opts.cookieKeys ?? []) {
            const c = (req as Request & { cookies?: Record<string, string> })
                .cookies?.[k]
            if (c !== undefined) ctx[k] = c
        }
        Object.assign(ctx, req.query)
        return ctx
    }

    private collectAjax(kind: 'ajaxPost' | 'ajaxGet') {
        const map: Record<
            string,
            (d: Record<string, unknown>) => Promise<unknown>
        > = {}
        for (const entry of Object.values(this.pages)) {
            if (typeof entry === 'string') continue
            Object.assign(map, entry[kind])
        }
        return map
    }

    getApp(): Express {
        const app = express()
        app.use(express.urlencoded({ extended: true }))
        app.use(express.json())
        app.use(cookieParser())
        if (this.opts.enableCors) app.use(this.corsMiddleware())

        const sub = this.opts.adminSubdomain
        const contentPrefix = `${sub}api/content/`
        const processPrefix = `${sub}api/process/`
        const ajaxPrefix = `${sub}api/ajax_content/`

        // GET /api/content/{pathname}
        app.get(
            new RegExp('^' + escapeRegExp(contentPrefix)),
            async (req: Request, res: Response) => {
                const pathname = decodeURIComponent(
                    req.path.slice(contentPrefix.length)
                )
                const page = this.resolvePage(pathname)
                if (!page) {
                    res.status(404).json({ error: 'page not found' })
                    return
                }
                try {
                    res.json(await page.getContent(this.contextFromRequest(req)))
                } catch (e) {
                    res.status(500).json({ error: String(e) })
                }
            }
        )

        // POST /api/process/{pathname}
        app.post(
            new RegExp('^' + escapeRegExp(processPrefix)),
            async (req: Request, res: Response) => {
                const pathname = decodeURIComponent(
                    req.path.slice(processPrefix.length)
                )
                const page = this.resolvePage(pathname)
                if (!page) {
                    res.status(404).json({ error: 'page not found' })
                    return
                }
                const data = aggregate(
                    form2dict(req.body as Record<string, unknown>),
                    this.opts.aggregationRule
                )
                try {
                    const result = await page.process(data)
                    if (typeof result !== 'string') {
                        if (!res.headersSent) res.status(204).end()
                        return
                    }
                    let url = result
                    if (url.startsWith('/')) {
                        url = sub + url.slice(1)
                        if (this.opts.disableServing && this.opts.servingUrl) {
                            url = this.opts.servingUrl + url
                        }
                    }
                    res.redirect(303, url)
                } catch (e) {
                    res.status(500).json({ error: String(e) })
                }
            }
        )

        // POST /api/ajax_content/{pathname}
        const postAjax = this.collectAjax('ajaxPost')
        const getAjax = this.collectAjax('ajaxGet')
        app.post(
            new RegExp('^' + escapeRegExp(ajaxPrefix)),
            async (req: Request, res: Response) => {
                const pathname = '/' + req.path.slice(ajaxPrefix.length)
                const fn = postAjax[pathname]
                if (!fn) {
                    res.status(404).json({ error: 'ajax handler not found' })
                    return
                }
                const data = aggregate(
                    form2dict(req.body as Record<string, unknown>),
                    this.opts.aggregationRule
                )
                res.json(await fn(data))
            }
        )
        app.get(
            new RegExp('^' + escapeRegExp(ajaxPrefix)),
            async (req: Request, res: Response) => {
                const pathname = '/' + req.path.slice(ajaxPrefix.length)
                const fn = getAjax[pathname]
                if (!fn) {
                    res.status(404).json({ error: 'ajax handler not found' })
                    return
                }
                const data = aggregate(
                    { ...(req.query as Record<string, unknown>) },
                    this.opts.aggregationRule
                )
                res.json(await fn(data))
            }
        )

        // GET /api/support/:name — bare boolean per feature name (mirrors pie)
        app.get(`${sub}api/support/:name`, (req: Request, res: Response) => {
            const name = req.params.name
            const supported =
                name === 'socketio'
                    ? !!this.opts.useSocketioSupport
                    : name === 'centrifuge'
                      ? !!this.opts.useCentrifugeSupport
                      : false
            res.json(supported)
        })

        // GET /api/centrifuge/gen_token
        app.get('/api/centrifuge/gen_token', (req: Request, res: Response) => {
            const secret = this.opts.centrifugeHmacSecret
            if (!secret) {
                res.status(403).json({ error: 'no centrifuge secret' })
                return
            }
            const cookies: Record<string, string> = {}
            for (const k of this.opts.cookieKeys ?? []) {
                const v = (req as Request & { cookies?: Record<string, string> })
                    .cookies?.[k]
                if (typeof v === 'string') cookies[k] = v
            }
            const subId =
                this.opts.centrifugeSubFn?.(cookies) ??
                createHash('sha256')
                    .update(JSON.stringify(cookies))
                    .digest('hex')
            const now = Math.floor(Date.now() / 1000)
            const token = jwt.sign(
                { sub: subId, iat: now, exp: now + 3600 },
                secret,
                { algorithm: 'HS256' }
            )
            res.json({ token })
        })

        return app
    }

    private corsMiddleware() {
        const origins = this.opts.corsOrigins
        return (req: Request, res: Response, next: NextFunction) => {
            const origin = req.headers.origin
            if (!origins || (origin && origins.includes(origin))) {
                res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
            }
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            res.setHeader('Vary', 'Origin')
            // Echo the requested headers (credentialed requests cannot use a
            // wildcard, so reflect exactly what the client asked to send).
            const reqHeaders = req.headers['access-control-request-headers']
            res.setHeader(
                'Access-Control-Allow-Headers',
                (Array.isArray(reqHeaders) ? reqHeaders.join(',') : reqHeaders) ||
                    'Content-Type'
            )
            if (req.method === 'OPTIONS') {
                res.sendStatus(204)
                return
            }
            next()
        }
    }
}
