import path from 'path'
import { glob } from 'glob'
import { ts } from '../ts'

type MethodsEntry = {
    event: string
    handler: string
    file: string
    line: number
}

const getStringLiteralFromJsxInitializer = (init: any): string | undefined => {
    if (!init) return
    if (ts.isStringLiteral(init)) return init.text
    if (
        ts.isJsxExpression(init) &&
        init.expression &&
        ts.isStringLiteral(init.expression)
    )
        return init.expression.text
}

const getAttribute = (attrs: any, name: string): any => {
    for (const prop of attrs.properties) {
        if (!ts.isJsxAttribute(prop)) continue
        if (ts.isIdentifier(prop.name) && prop.name.text === name) return prop
    }
}

const extractMethodsFromObjectLiteral = (
    obj: any,
    sourceFile: any
): Array<{ event: string; handler: string; line: number }> => {
    const out: Array<{ event: string; handler: string; line: number }> = []
    for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop)) {
            const key =
                ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
                    ? prop.name.text
                    : undefined
            if (!key) continue
            const handler = prop.initializer.getText(sourceFile)
            const lc = sourceFile.getLineAndCharacterOfPosition(prop.getStart())
            out.push({ event: key, handler, line: lc.line + 1 })
            continue
        }
        if (ts.isShorthandPropertyAssignment(prop)) {
            const key = prop.name.text
            const handler = prop.name.text
            const lc = sourceFile.getLineAndCharacterOfPosition(prop.getStart())
            out.push({ event: key, handler, line: lc.line + 1 })
            continue
        }
        if (ts.isMethodDeclaration(prop)) {
            const key =
                ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
                    ? prop.name.text
                    : undefined
            if (!key) continue
            const handler = prop.name.getText(sourceFile)
            const lc = sourceFile.getLineAndCharacterOfPosition(prop.getStart())
            out.push({ event: key, handler, line: lc.line + 1 })
        }
    }
    return out
}

const resolveIdentifierToObjectLiteral = (expr: any, checker: any): any => {
    if (!ts.isIdentifier(expr)) return
    const symbol = checker.getSymbolAtLocation(expr)
    if (!symbol) return

    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0]
    if (!decl) return

    if (ts.isVariableDeclaration(decl) && decl.initializer) {
        if (ts.isObjectLiteralExpression(decl.initializer))
            return decl.initializer
    }

    if (ts.isPropertyAssignment(decl)) {
        const init = decl.initializer
        if (ts.isObjectLiteralExpression(init)) return init
    }
}

export const listEventsCommand = (srcDir: string, componentName: string) => {
    console.log(`[pieui] Scanning PieCard methods for: ${componentName}`)

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx,js,jsx}`, {
        ignore: [
            '**/*.d.ts',
            '**/dist/**',
            '**/node_modules/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/tests/**',
            '**/__tests__/**',
        ],
    })

    const compilerOptions = {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
    }

    const program = ts.createProgram(files, compilerOptions)
    const checker = program.getTypeChecker()

    const entries: MethodsEntry[] = []

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue
        if (
            !files.some(
                (f) => path.resolve(f) === path.resolve(sourceFile.fileName)
            )
        )
            continue

        const visit = (node: any) => {
            const isPieCardTag = (tagName: any) =>
                ts.isIdentifier(tagName) && tagName.text === 'PieCard'

            if (
                ts.isJsxSelfClosingElement(node) &&
                isPieCardTag(node.tagName)
            ) {
                const attrs = node.attributes
                const cardAttr = getAttribute(attrs, 'card')
                const cardValue = getStringLiteralFromJsxInitializer(
                    cardAttr?.initializer
                )
                if (cardValue !== componentName) {
                    ts.forEachChild(node, visit)
                    return
                }

                const methodsAttr = getAttribute(attrs, 'methods')
                const init = methodsAttr?.initializer
                const expr =
                    init && ts.isJsxExpression(init)
                        ? init.expression
                        : undefined
                if (!expr) {
                    ts.forEachChild(node, visit)
                    return
                }

                let obj: any
                if (ts.isObjectLiteralExpression(expr)) obj = expr
                else obj = resolveIdentifierToObjectLiteral(expr, checker)
                if (!obj) {
                    ts.forEachChild(node, visit)
                    return
                }

                const found = extractMethodsFromObjectLiteral(obj, sourceFile)
                for (const f of found) {
                    entries.push({
                        event: f.event,
                        handler: f.handler,
                        file: path.relative(process.cwd(), sourceFile.fileName),
                        line: f.line,
                    })
                }

                ts.forEachChild(node, visit)
                return
            }

            if (ts.isJsxOpeningElement(node) && isPieCardTag(node.tagName)) {
                const attrs = node.attributes
                const cardAttr = getAttribute(attrs, 'card')
                const cardValue = getStringLiteralFromJsxInitializer(
                    cardAttr?.initializer
                )
                if (cardValue !== componentName) {
                    ts.forEachChild(node, visit)
                    return
                }

                const methodsAttr = getAttribute(attrs, 'methods')
                const init = methodsAttr?.initializer
                const expr =
                    init && ts.isJsxExpression(init)
                        ? init.expression
                        : undefined
                if (!expr) {
                    ts.forEachChild(node, visit)
                    return
                }

                let obj: any
                if (ts.isObjectLiteralExpression(expr)) obj = expr
                else obj = resolveIdentifierToObjectLiteral(expr, checker)
                if (!obj) {
                    ts.forEachChild(node, visit)
                    return
                }

                const found = extractMethodsFromObjectLiteral(obj, sourceFile)
                for (const f of found) {
                    entries.push({
                        event: f.event,
                        handler: f.handler,
                        file: path.relative(process.cwd(), sourceFile.fileName),
                        line: f.line,
                    })
                }

                ts.forEachChild(node, visit)
                return
            }

            ts.forEachChild(node, visit)
        }

        visit(sourceFile)
    }

    if (entries.length === 0) {
        console.log(`[pieui] No methods found for: ${componentName}`)
        return
    }

    entries.sort((a, b) => a.event.localeCompare(b.event))

    const headers = ['Event', 'Handler', 'File', 'Line']
    const rows = entries.map((e) => [
        e.event,
        e.handler,
        e.file,
        String(e.line),
    ])

    const colWidths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => r[i].length))
    )

    const separator = colWidths.map((w) => '─'.repeat(w + 2)).join('┼')
    const formatRow = (cells: string[]) =>
        cells.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join('│')

    console.log('')
    console.log(formatRow(headers))
    console.log(separator)
    for (const row of rows) {
        console.log(formatRow(row))
    }
    console.log('')
    console.log(`[pieui] Total: ${entries.length}`)
}
