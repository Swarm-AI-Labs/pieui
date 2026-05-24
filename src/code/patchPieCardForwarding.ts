/**
 * `pieui card add-story` post-processors that make a card's `<PieCard>`
 * usage Storybook-ready:
 *
 *   - `detectCardIsIO(typesPath)` — does the card's data interface declare
 *     IO realtime fields (`useMittSupport`, `useSocketioSupport`, …).
 *   - `patchPieCardForwarding(uiPath, options)` — adds missing forwarding
 *     attributes to every `<PieCard>` JSX element in the file. For IO cards
 *     this includes the realtime quartet so the addon's "Fire" buttons reach
 *     the card; for non-IO cards only `data` is enforced (forwarding fields
 *     the data interface doesn't declare would break typechecking).
 *     Idempotent.
 */

import fs from 'node:fs'
import { ts } from './ts'

const IO_FIELDS = [
    'useSocketioSupport',
    'useCentrifugeSupport',
    'useMittSupport',
    'centrifugeChannel',
]

const FIELD_DECL_RE = (name: string) =>
    new RegExp(`(^|[\\s\\{,;])${name}\\s*\\??\\s*:`)

export const detectCardIsIO = (typesPath: string): boolean => {
    if (!fs.existsSync(typesPath)) return false
    const source = fs.readFileSync(typesPath, 'utf8')
    return IO_FIELDS.some((field) => FIELD_DECL_RE(field).test(source))
}

type ForwardingProp = { name: string; expr: string }

const forwardingPropsFor = (isIO: boolean): ForwardingProp[] => {
    // `data` is read at runtime by PieCard (`data.name` becomes part of the
    // mitt/socket event name). Without it PieCard throws "Cannot read
    // properties of undefined (reading 'name')".
    if (!isIO) {
        return [{ name: 'data', expr: 'data' }]
    }
    return [
        { name: 'data', expr: 'data' },
        {
            name: 'useSocketioSupport',
            expr: 'data.useSocketioSupport ?? false',
        },
        {
            name: 'useCentrifugeSupport',
            expr: 'data.useCentrifugeSupport ?? false',
        },
        {
            name: 'useMittSupport',
            expr: 'data.useMittSupport ?? false',
        },
        {
            name: 'centrifugeChannel',
            expr: 'data.centrifugeChannel',
        },
    ]
}

const indentOfFirstAttr = (
    source: string,
    sourceFile: any,
    attrs: any
): { indent: string; multiline: boolean } => {
    const first = attrs.properties[0]
    if (!first) return { indent: '            ', multiline: true }
    const start = first.getStart(sourceFile)
    const lineStart = source.lastIndexOf('\n', start) + 1
    const lineText = source.slice(lineStart, start)
    // If everything before the attribute on this line is whitespace, it's a
    // multi-line opening tag and we can reuse the indent.
    if (/^\s+$/.test(lineText)) {
        return { indent: lineText, multiline: true }
    }
    return { indent: '            ', multiline: false }
}

export type PieCardForwardingResult = {
    patched: boolean
    addedPerSite: Array<{ site: number; added: string[] }>
}

export const patchPieCardForwarding = (
    uiPath: string,
    options: { io: boolean } = { io: false }
): PieCardForwardingResult => {
    if (!fs.existsSync(uiPath)) {
        return { patched: false, addedPerSite: [] }
    }
    const source = fs.readFileSync(uiPath, 'utf8')
    const sourceFile = ts.createSourceFile(
        uiPath,
        source,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TSX
    )

    const required = forwardingPropsFor(options.io)
    const insertions: Array<{ pos: number; text: string }> = []
    const addedPerSite: Array<{ site: number; added: string[] }> = []

    const visit = (node: any): void => {
        const isPieCard =
            (ts.isJsxSelfClosingElement(node) ||
                ts.isJsxOpeningElement(node)) &&
            ts.isIdentifier(node.tagName) &&
            node.tagName.text === 'PieCard'
        if (isPieCard) {
            const attrs = node.attributes
            const existing = new Set<string>()
            let hasSpread = false
            for (const a of attrs.properties) {
                if (ts.isJsxAttribute(a) && ts.isIdentifier(a.name)) {
                    existing.add(a.name.text)
                } else if (ts.isJsxSpreadAttribute(a)) {
                    hasSpread = true
                }
            }
            if (!hasSpread) {
                const missing = required.filter((p) => !existing.has(p.name))
                if (missing.length > 0) {
                    const { indent, multiline } = indentOfFirstAttr(
                        source,
                        sourceFile,
                        attrs
                    )
                    const insertion = missing
                        .map((p) =>
                            multiline
                                ? `\n${indent}${p.name}={${p.expr}}`
                                : ` ${p.name}={${p.expr}}`
                        )
                        .join('')
                    const insertAt = attrs.getEnd()
                    insertions.push({ pos: insertAt, text: insertion })
                    addedPerSite.push({
                        site: node.getStart(sourceFile),
                        added: missing.map((p) => p.name),
                    })
                }
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)

    if (insertions.length === 0) {
        return { patched: false, addedPerSite }
    }

    insertions.sort((a, b) => b.pos - a.pos)
    let result = source
    for (const ins of insertions) {
        result = result.slice(0, ins.pos) + ins.text + result.slice(ins.pos)
    }
    fs.writeFileSync(uiPath, result, 'utf8')
    return { patched: true, addedPerSite }
}
