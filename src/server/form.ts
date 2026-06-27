/** Normalise a parsed form body: a single-element array collapses to a scalar. */
export function form2dict(
    body: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body ?? {})) {
        out[k] = Array.isArray(v) && v.length === 1 ? v[0] : v
    }
    return out
}

/** Optional `by_underscore` nesting: `addr__city` → `addr.city`. Mirrors pie aggregate. */
export function aggregate(
    data: Record<string, unknown>,
    rule?: 'by_underscore'
): Record<string, unknown> {
    if (rule !== 'by_underscore') return data
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
        const idx = k.indexOf('__')
        if (idx === -1) {
            out[k] = v
        } else {
            const parent = k.slice(0, idx)
            const child = k.slice(idx + 2)
            const bucket = (out[parent] ??= {}) as Record<string, unknown>
            bucket[child] = v
        }
    }
    return out
}
