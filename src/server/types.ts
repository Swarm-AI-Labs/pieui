import type { UIConfigType } from '../types'

export type { UIConfigType }

/** A realtime event: name `pie{method}_{cardName}` + payload. Mirrors pie's SocketIOEvent. */
export interface SocketIOEvent {
    name: string
    data: Record<string, unknown>
}

/** Subset of request context handed to page methods (cookies + query + body merged). */
export type PageContext = Record<string, unknown>

export interface WebOptions {
    cookieKeys?: string[]
    cookieOptions?: Record<string, unknown>
    enableCors?: boolean
    corsOrigins?: string[]
    /** Route prefix; must start and end with "/". Default "/". Mirrors pie admin_subdomain. */
    adminSubdomain?: string
    disableServing?: boolean
    servingUrl?: string
    assetsPath?: string
    aggregationRule?: 'by_underscore'
    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    centrifugeUrl?: string
    centrifugeApiKey?: string
    centrifugeHmacSecret?: string
    centrifugeSubFn?: (cookies: Record<string, string>) => string
}
