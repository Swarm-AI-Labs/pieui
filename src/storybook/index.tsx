'use client'

import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import mitt, { Emitter } from 'mitt'

import MittContext from '../util/mitt'
import SocketIOContext from '../util/socket'
import CentrifugeIOContext from '../util/centrifuge'
import FallbackContext from '../util/fallback'
import { PieConfigContext } from '../util/pieConfig'

const STORYBOOK_PIE_CONFIG = {
    apiServer: '',
    centrifugeServer: '',
    enableRenderingLog: false,
    pageProcessor: '',
}

const SBQueryClientRef: { current: QueryClient | null } = { current: null }
const getQueryClient = () => {
    if (!SBQueryClientRef.current) {
        SBQueryClientRef.current = new QueryClient({
            defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
            },
        })
    }
    return SBQueryClientRef.current
}

type SBEmitter = Emitter<Record<string, unknown>>

const SBEmitterContext = createContext<SBEmitter | null>(null)

export const usePieStorybookEmitter = (): SBEmitter => {
    const ctx = useContext(SBEmitterContext)
    if (!ctx) {
        throw new Error(
            'usePieStorybookEmitter must be used inside <PieStorybookProviders />'
        )
    }
    return ctx
}

export type PieStorybookProvidersProps = {
    children: ReactNode
    emitter?: SBEmitter
    pieConfig?: Partial<typeof STORYBOOK_PIE_CONFIG>
}

export const PieStorybookProviders = ({
    children,
    emitter,
    pieConfig,
}: PieStorybookProvidersProps) => {
    const localEmitter = useMemo<SBEmitter>(
        () => emitter ?? mitt<Record<string, unknown>>(),
        [emitter]
    )
    const config = useMemo(
        () => ({ ...STORYBOOK_PIE_CONFIG, ...(pieConfig ?? {}) }),
        [pieConfig]
    )

    return (
        <QueryClientProvider client={getQueryClient()}>
            <PieConfigContext.Provider value={config}>
                <FallbackContext.Provider value={<></>}>
                    <SBEmitterContext.Provider value={localEmitter}>
                        <MittContext.Provider value={localEmitter}>
                            <SocketIOContext.Provider
                                value={null as never}
                            >
                                <CentrifugeIOContext.Provider
                                    value={null as never}
                                >
                                    {children}
                                </CentrifugeIOContext.Provider>
                            </SocketIOContext.Provider>
                        </MittContext.Provider>
                    </SBEmitterContext.Provider>
                </FallbackContext.Provider>
            </PieConfigContext.Provider>
        </QueryClientProvider>
    )
}

export const withPieCard = (Story: (props?: unknown) => ReactNode) => (
    <PieStorybookProviders>
        <PieStorybookChannelBridge />
        <Story />
    </PieStorybookProviders>
)

const pieEventName = (cardName: string, methodName: string): string =>
    `pie${methodName}_${cardName}`

export const firePieMethod = (
    emitter: SBEmitter,
    cardName: string,
    methodName: string,
    payload: unknown
): void => {
    emitter.emit(pieEventName(cardName, methodName), payload)
}

export type PieMethodTriggerProps = {
    card: string
    method: string
    payload?: unknown
    label?: string
}

export const PieMethodTrigger = ({
    card,
    method,
    payload,
    label,
}: PieMethodTriggerProps) => {
    const emitter = usePieStorybookEmitter()
    return (
        <button
            type="button"
            onClick={() => firePieMethod(emitter, card, method, payload)}
            style={{
                padding: '6px 12px',
                marginRight: 8,
                marginBottom: 8,
                fontSize: 12,
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                background: '#f7f7f7',
            }}
        >
            {label ?? `${card}.${method}`}
        </button>
    )
}

export type PieMethodSpec = {
    name: string
    payloadSchema?: Record<string, unknown> | null
    payloadCode?: string | null
    samplePayload?: unknown
}

export type PieCardParams = {
    card: string
    methods?: PieMethodSpec[]
}

export const PIECARD_PARAM_KEY = 'piecard'

const STORYBOOK_CHANNEL_FIRE_EVENT = 'piecard/fire'

type ChannelLike = {
    on: (event: string, listener: (...args: unknown[]) => void) => void
    off: (event: string, listener: (...args: unknown[]) => void) => void
}

const getStorybookChannel = (): ChannelLike | null => {
    const w = globalThis as unknown as {
        __STORYBOOK_ADDONS_CHANNEL__?: ChannelLike
    }
    return w.__STORYBOOK_ADDONS_CHANNEL__ ?? null
}

export const PieStorybookChannelBridge = () => {
    const emitter = usePieStorybookEmitter()
    const emitterRef = useRef(emitter)
    emitterRef.current = emitter

    useEffect(() => {
        const channel = getStorybookChannel()
        if (!channel) return
        const handler = (...args: unknown[]) => {
            const detail = args[0] as
                | { card?: string; method?: string; payload?: unknown }
                | undefined
            if (!detail || !detail.card || !detail.method) return
            firePieMethod(
                emitterRef.current,
                detail.card,
                detail.method,
                detail.payload
            )
        }
        channel.on(STORYBOOK_CHANNEL_FIRE_EVENT, handler)
        return () => channel.off(STORYBOOK_CHANNEL_FIRE_EVENT, handler)
    }, [])

    return null
}

export const PIE_STORYBOOK_FIRE_EVENT = STORYBOOK_CHANNEL_FIRE_EVENT
