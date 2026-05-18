import * as React from 'react'
import { ChangeEvent, ReactElement, useEffect, useMemo, useState } from 'react'

void React
import { addons, useParameter } from 'storybook/manager-api'
import {
    PIECARD_PARAM_KEY,
    PIE_STORYBOOK_FIRE_EVENT,
    PieCardParams,
    PieMethodSpec,
} from './constants'

const Pre = ({
    children,
    style,
}: {
    children: string
    style?: Record<string, unknown>
}) => (
    <pre
        style={{
            margin: 0,
            padding: 8,
            fontSize: 11,
            background: '#f5f5f5',
            border: '1px solid #e0e0e0',
            borderRadius: 4,
            overflow: 'auto',
            ...(style ?? {}),
        }}
    >
        {children}
    </pre>
)

const defaultPayloadFor = (method: PieMethodSpec): string => {
    if (method.samplePayload !== undefined) {
        try {
            return JSON.stringify(method.samplePayload, null, 2)
        } catch {
            /* noop */
        }
    }
    const schema = method.payloadSchema
    if (!schema || typeof schema !== 'object') return '{}'
    const properties = (schema.properties ?? {}) as Record<string, unknown>
    if (!Object.keys(properties).length) return '{}'
    const sample: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(properties)) {
        if (typeof val !== 'object' || val === null) continue
        const t = (val as { type?: string }).type
        if (t === 'string') sample[key] = ''
        else if (t === 'number' || t === 'integer') sample[key] = 0
        else if (t === 'boolean') sample[key] = false
        else if (t === 'array') sample[key] = []
        else if (t === 'object') sample[key] = {}
        else sample[key] = null
    }
    return JSON.stringify(sample, null, 2)
}

const MethodRow = ({
    card,
    method,
}: {
    card: string
    method: PieMethodSpec
}): ReactElement => {
    const initialPayload = useMemo(() => defaultPayloadFor(method), [method])
    const [payload, setPayload] = useState(initialPayload)
    const [error, setError] = useState<string | null>(null)
    const [lastFiredAt, setLastFiredAt] = useState<number | null>(null)

    const fire = () => {
        let parsed: unknown = undefined
        const trimmed = payload.trim()
        if (trimmed.length > 0) {
            try {
                parsed = JSON.parse(trimmed)
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Invalid JSON payload'
                )
                return
            }
        }
        setError(null)
        addons.getChannel().emit(PIE_STORYBOOK_FIRE_EVENT, {
            card,
            method: method.name,
            payload: parsed,
        })
        setLastFiredAt(Date.now())
    }

    return (
        <div
            style={{
                padding: 12,
                borderBottom: '1px solid #eee',
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 6,
                }}
            >
                <code style={{ fontSize: 13, fontWeight: 600 }}>
                    {card}.{method.name}
                </code>
                <button
                    type="button"
                    onClick={fire}
                    style={{
                        marginLeft: 'auto',
                        padding: '4px 10px',
                        fontSize: 12,
                        background: '#1ea7fd',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                    }}
                >
                    Fire
                </button>
            </div>
            {method.payloadCode ? (
                <details style={{ marginBottom: 6 }}>
                    <summary style={{ fontSize: 11, cursor: 'pointer' }}>
                        Payload type
                    </summary>
                    <Pre>{method.payloadCode}</Pre>
                </details>
            ) : null}
            <textarea
                value={payload}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setPayload(e.target.value)
                }
                rows={Math.min(10, Math.max(2, payload.split('\n').length))}
                style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    padding: 6,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                }}
            />
            {error ? (
                <div
                    style={{
                        marginTop: 4,
                        color: '#c00',
                        fontSize: 11,
                    }}
                >
                    {error}
                </div>
            ) : null}
            {lastFiredAt ? (
                <div
                    style={{
                        marginTop: 4,
                        color: '#666',
                        fontSize: 11,
                    }}
                >
                    Fired at {new Date(lastFiredAt).toLocaleTimeString()}
                </div>
            ) : null}
        </div>
    )
}

export const Panel = ({
    active,
}: {
    active?: boolean
}): ReactElement | null => {
    const params = useParameter<PieCardParams | null>(PIECARD_PARAM_KEY, null)

    useEffect(() => {
        // No-op effect just to encourage re-render when params change.
    }, [params])

    if (!active) return null
    if (!params || !params.card) {
        return (
            <div style={{ padding: 16, fontSize: 13, color: '#666' }}>
                <strong>No PieCard parameters on this story.</strong>
                <p style={{ marginTop: 8 }}>
                    Add{' '}
                    <code>
                        parameters.{PIECARD_PARAM_KEY} = {'{'} card, methods{' '}
                        {'}'}
                    </code>{' '}
                    to your story to surface method triggers here.
                </p>
            </div>
        )
    }
    const methods = params.methods ?? []
    if (methods.length === 0) {
        return (
            <div style={{ padding: 16, fontSize: 13, color: '#666' }}>
                No methods declared for <code>{params.card}</code>.
            </div>
        )
    }
    return (
        <div>
            {methods.map((m: PieMethodSpec) => (
                <MethodRow key={m.name} card={params.card} method={m} />
            ))}
        </div>
    )
}
