/**
 * Compare two PieMetadata blobs (Python ↔ TS) and report divergences.
 * Mirror of pie/code/metadata_compare.py.
 *
 * Policies (per spec discussion):
 *   A. `required` may differ if base types match modulo nullability.
 *      Flag only true type/nullability mismatches.
 *   B. Framework-internal fields (`content`) are excluded server-side
 *      before serializing — comparison is symmetric.
 *   C. inputProps: Python ⇒ class extends InputCard; TS ⇒ `<PieCard stored={…}>`.
 *      Both must be present or both absent.
 *   D. IO-mixin fields must be declared on both sides (no special-case).
 */

export type PieMetadataLike = {
    name?: string
    events?: string[]
    ajaxList?: string[]
    propsSchema?: Record<string, unknown> | null
    inputPropsCode?: string | null
    inputPropsSchema?: Record<string, unknown> | null
}

export type Finding = {
    kind: string
    message: string
    [key: string]: unknown
}

const toCamel = (name: string): string => {
    const parts = name.split('_')
    return (
        parts[0] +
        parts
            .slice(1)
            .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ''))
            .join('')
    )
}

const normalizeAjax = (names: string[]): string[] =>
    Array.from(new Set(names.map(toCamel))).sort()

const baseType = (schema: unknown): { types: Set<string>; nullable: boolean } => {
    if (!schema || typeof schema !== 'object') {
        return { types: new Set(), nullable: false }
    }
    const s = schema as Record<string, unknown>
    let nullable = false

    if (Array.isArray(s.anyOf)) {
        const types = new Set<string>()
        for (const v of s.anyOf) {
            const r = baseType(v)
            r.types.forEach((t) => types.add(t))
            nullable = nullable || r.nullable
        }
        return { types, nullable }
    }

    const t = s.type
    if (Array.isArray(t)) {
        if ((t as unknown[]).includes('null')) nullable = true
        const types = new Set(
            (t as string[]).filter((x) => x !== 'null')
        )
        return { types, nullable }
    }
    if (typeof t === 'string') {
        if (t === 'null') return { types: new Set(), nullable: true }
        return { types: new Set([t]), nullable: false }
    }

    if ('const' in s) {
        const v = s.const
        if (typeof v === 'boolean') return { types: new Set(['boolean']), nullable: false }
        if (typeof v === 'number')
            return {
                types: new Set([Number.isInteger(v) ? 'integer' : 'number']),
                nullable: false,
            }
        if (typeof v === 'string') return { types: new Set(['string']), nullable: false }
        if (v === null) return { types: new Set(), nullable: true }
    }
    return { types: new Set(), nullable: false }
}

const propsKeys = (schema: unknown): Set<string> => {
    if (!schema || typeof schema !== 'object') return new Set()
    const props = (schema as Record<string, unknown>).properties
    if (!props || typeof props !== 'object') return new Set()
    return new Set(Object.keys(props))
}

const isOptionalViaRequired = (key: string, schema: unknown): boolean => {
    if (!schema || typeof schema !== 'object') return true
    const req = (schema as Record<string, unknown>).required
    if (!Array.isArray(req)) return true
    return !(req as string[]).includes(key)
}

const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size !== b.size) return false
    for (const x of a) if (!b.has(x)) return false
    return true
}

const diffSchema = (
    py: Record<string, unknown>,
    ts: Record<string, unknown>,
    label: string
): Finding[] => {
    const out: Finding[] = []
    const ka = propsKeys(py)
    const kb = propsKeys(ts)
    const onlyPy = [...ka].filter((k) => !kb.has(k)).sort()
    const onlyTs = [...kb].filter((k) => !ka.has(k)).sort()
    if (onlyPy.length > 0) {
        out.push({
            kind: 'missing_field',
            scope: label,
            side: 'py',
            fields: onlyPy,
            message: `${label}: fields in Python but not TS: ${JSON.stringify(onlyPy)}`,
        })
    }
    if (onlyTs.length > 0) {
        out.push({
            kind: 'missing_field',
            scope: label,
            side: 'ts',
            fields: onlyTs,
            message: `${label}: fields in TS but not Python: ${JSON.stringify(onlyTs)}`,
        })
    }

    const pyProps = (py.properties as Record<string, unknown>) || {}
    const tsProps = (ts.properties as Record<string, unknown>) || {}
    const shared = [...ka].filter((k) => kb.has(k)).sort()
    for (const key of shared) {
        const py_t = baseType(pyProps[key])
        const ts_t = baseType(tsProps[key])
        const opt_py = py_t.nullable || isOptionalViaRequired(key, py)
        const opt_ts = ts_t.nullable || isOptionalViaRequired(key, ts)
        if (!setsEqual(py_t.types, ts_t.types)) {
            out.push({
                kind: 'type_mismatch',
                scope: label,
                field: key,
                py: [...py_t.types].sort(),
                ts: [...ts_t.types].sort(),
                message: `${label}.${key}: type Python=${JSON.stringify(
                    [...py_t.types].sort()
                )} TS=${JSON.stringify([...ts_t.types].sort())}`,
            })
        } else if (opt_py !== opt_ts) {
            out.push({
                kind: 'nullability_mismatch',
                scope: label,
                field: key,
                py_nullable: opt_py,
                ts_nullable: opt_ts,
                message: `${label}.${key}: Python ${
                    opt_py ? 'allows null' : 'is required+non-null'
                }, TS ${ts_t.nullable || !ts.required ? 'allows null' : 'is required+non-null'}`,
            })
        }
    }
    return out
}

export const compareMetadata = (
    py: PieMetadataLike,
    ts: PieMetadataLike
): Finding[] => {
    const findings: Finding[] = []

    if (py.name !== ts.name) {
        findings.push({
            kind: 'name_mismatch',
            py: py.name,
            ts: ts.name,
            message: `name: Python=${JSON.stringify(py.name)} TS=${JSON.stringify(ts.name)}`,
        })
    }

    const pyEv = new Set(py.events || [])
    const tsEv = new Set(ts.events || [])
    const onlyPyEv = [...pyEv].filter((e) => !tsEv.has(e)).sort()
    const onlyTsEv = [...tsEv].filter((e) => !pyEv.has(e)).sort()
    if (onlyPyEv.length > 0) {
        findings.push({
            kind: 'events_diverge',
            side: 'py',
            events: onlyPyEv,
            message: `events: only in Python: ${JSON.stringify(onlyPyEv)}`,
        })
    }
    if (onlyTsEv.length > 0) {
        findings.push({
            kind: 'events_diverge',
            side: 'ts',
            events: onlyTsEv,
            message: `events: only in TS: ${JSON.stringify(onlyTsEv)}`,
        })
    }

    const pyAx = new Set(normalizeAjax(py.ajaxList || []))
    const tsAx = new Set(ts.ajaxList || [])
    const onlyPyAx = [...pyAx].filter((x) => !tsAx.has(x)).sort()
    const onlyTsAx = [...tsAx].filter((x) => !pyAx.has(x)).sort()
    if (onlyPyAx.length > 0) {
        findings.push({
            kind: 'ajax_diverge',
            side: 'py',
            fields: onlyPyAx,
            message: `ajaxList: only in Python (camelCased): ${JSON.stringify(onlyPyAx)}`,
        })
    }
    if (onlyTsAx.length > 0) {
        findings.push({
            kind: 'ajax_diverge',
            side: 'ts',
            fields: onlyTsAx,
            message: `ajaxList: only in TS: ${JSON.stringify(onlyTsAx)}`,
        })
    }

    findings.push(
        ...diffSchema(
            (py.propsSchema as Record<string, unknown>) || {},
            (ts.propsSchema as Record<string, unknown>) || {},
            'propsSchema'
        )
    )

    const pyInput = py.inputPropsCode != null
    const tsInput = ts.inputPropsCode != null
    if (pyInput !== tsInput) {
        findings.push({
            kind: 'input_presence_mismatch',
            py: pyInput,
            ts: tsInput,
            message: `inputProps: Python ${
                pyInput ? 'present (class extends InputCard)' : 'absent'
            }, TS ${tsInput ? 'present (<PieCard stored=...>)' : 'absent'}`,
        })
    } else if (pyInput && tsInput) {
        findings.push(
            ...diffSchema(
                (py.inputPropsSchema as Record<string, unknown>) || {},
                (ts.inputPropsSchema as Record<string, unknown>) || {},
                'inputPropsSchema'
            )
        )
    }

    return findings
}

export const formatFindings = (
    componentName: string,
    findings: Finding[]
): string => {
    const lines: string[] = [`=== ${componentName} ===`]
    if (findings.length === 0) {
        lines.push(
            '  ✓ in sync (name, events, ajaxList, propsSchema, inputProps)'
        )
        return lines.join('\n')
    }
    for (const f of findings) lines.push(`  - ${f.message}`)
    return lines.join('\n')
}
