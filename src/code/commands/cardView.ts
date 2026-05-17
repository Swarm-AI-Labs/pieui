import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../services/settings'

const AJAX_FIELD_NAMES = new Set(['pathname', 'deps_names', 'kwargs'])
const IO_FIELD_RE = /\buse_[A-Za-z0-9_]+_support\b/g

type PropRow = { name: string; type: string; default: string }

const extractInterfaceBody = (
    source: string,
    interfaceName: string
): string | null => {
    const idx = source.indexOf(`interface ${interfaceName}`)
    if (idx === -1) return null
    const braceStart = source.indexOf('{', idx)
    if (braceStart === -1) return null
    let depth = 0
    for (let i = braceStart; i < source.length; i++) {
        const ch = source[i]
        if (ch === '{') depth++
        else if (ch === '}') {
            depth--
            if (depth === 0) return source.slice(braceStart + 1, i)
        }
    }
    return null
}

const parseProps = (body: string): PropRow[] => {
    const props: PropRow[] = []
    const lineRe =
        /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*([^;\n]+?)\s*;?\s*$/gm
    let match: RegExpExecArray | null
    while ((match = lineRe.exec(body)) !== null) {
        const [, name, optional, typeRaw] = match
        props.push({
            name,
            type: typeRaw.trim(),
            default: optional ? '(optional)' : '(required)',
        })
    }
    return props
}

const formatTable = (headers: string[], rows: string[][]): string => {
    const data = [headers, ...rows]
    const widths = headers.map((_, c) =>
        Math.max(...data.map((row) => (row[c] ?? '').length))
    )
    const hline = `+${widths.map((w) => '-'.repeat(w + 2)).join('+')}+`
    const fmtRow = (cells: string[]) =>
        `|${cells
            .map((cell, i) => ` ${(cell ?? '').padEnd(widths[i])} `)
            .join('|')}|`
    return [hline, fmtRow(headers), hline, ...rows.map(fmtRow), hline].join('\n')
}

export const cardViewCommand = (componentName: string): void => {
    const settings = loadSettings()
    const componentDir = path.join(settings.componentsDir, componentName)

    if (!fs.existsSync(componentDir)) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const typesPath = path.join(componentDir, 'types.ts')
    const indexPath = path.join(componentDir, 'index.tsx')
    const indexPathTs = path.join(componentDir, 'index.ts')

    const typesSource = fs.existsSync(typesPath)
        ? fs.readFileSync(typesPath, 'utf8')
        : ''
    const indexSource = fs.existsSync(indexPath)
        ? fs.readFileSync(indexPath, 'utf8')
        : fs.existsSync(indexPathTs)
          ? fs.readFileSync(indexPathTs, 'utf8')
          : ''

    const dataInterface =
        extractInterfaceBody(typesSource, `${componentName}Data`) ?? ''
    const props = parseProps(dataInterface)

    const hasAjax = props.some((p) => AJAX_FIELD_NAMES.has(p.name))
    const ioFields = props
        .map((p) => p.name)
        .filter((name) => IO_FIELD_RE.test(name))
    IO_FIELD_RE.lastIndex = 0

    const events: string[] = []
    const eventRe =
        /\b(?:on|create)([A-Z][A-Za-z0-9]*)Event\b|methods\s*=\s*\{([\s\S]*?)\}/g
    const methodsMatch = indexSource.match(/methods\s*=\s*\{([\s\S]*?)\}/)
    if (methodsMatch) {
        const inner = methodsMatch[1]
        const keyRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:/g
        let m: RegExpExecArray | null
        while ((m = keyRe.exec(inner)) !== null) events.push(m[1])
    }
    void eventRe

    console.log('Name:')
    console.log(componentName)
    console.log('')
    console.log('File:')
    console.log(path.resolve(componentDir))
    console.log('')
    console.log('Props:')
    if (props.length === 0) {
        console.log('(none)')
    } else {
        console.log(
            formatTable(
                ['Name', 'Type', 'Default'],
                props.map((p) => [p.name, p.type, p.default])
            )
        )
    }
    console.log('')
    console.log('Ajax:')
    console.log(hasAjax ? 'yes' : 'no')
    console.log('')
    console.log('IO:')
    if (ioFields.length === 0) {
        console.log('no')
    } else {
        console.log(formatTable(['name'], ioFields.map((n) => [n])))
    }
    console.log('')
    console.log('Events:')
    if (events.length === 0) {
        console.log('no (run `pieui card list-events ' + componentName + '`)')
    } else {
        console.log(formatTable(['event'], events.map((e) => [e])))
    }
}