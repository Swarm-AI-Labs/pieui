import path from 'path'
import { glob } from 'glob'
import { ts } from '../ts'
import { ComponentType, ListFilter, REGISTER_FUNCTION } from '../types'
import { detectComponentType } from '../scan'

type ComponentListEntry = {
    name: string
    type: ComponentType
    file: string
    dataType: string
    lazy: boolean
}

export const listCommand = (srcDir: string, filter: ListFilter) => {
    console.log(`[pieui] Scanning components in: ${srcDir}`)

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx}`, {
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

    const components: ComponentListEntry[] = []

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue
        if (
            !files.some(
                (f) => path.resolve(f) === path.resolve(sourceFile.fileName)
            )
        )
            continue

        function visit(node: any) {
            if (ts.isCallExpression(node)) {
                const expr = node.expression
                const isRegisterCall =
                    (ts.isIdentifier(expr) &&
                        expr.text === REGISTER_FUNCTION) ||
                    (ts.isPropertyAccessExpression(expr) &&
                        expr.name.text === REGISTER_FUNCTION)

                if (isRegisterCall && node.arguments.length > 0) {
                    const arg = node.arguments[0]
                    if (ts.isObjectLiteralExpression(arg)) {
                        let componentName: string | null = null
                        let componentRef: any | null = null
                        let hasLoader = false

                        for (const prop of arg.properties) {
                            if (ts.isPropertyAssignment(prop)) {
                                const propName =
                                    ts.isIdentifier(prop.name) ||
                                    ts.isStringLiteral(prop.name)
                                        ? prop.name.text
                                        : null

                                if (
                                    propName === 'name' &&
                                    ts.isStringLiteral(prop.initializer)
                                ) {
                                    componentName = prop.initializer.text
                                }
                                if (propName === 'component') {
                                    componentRef = prop.initializer
                                }
                                if (propName === 'loader') {
                                    hasLoader = true
                                }
                            } else if (ts.isShorthandPropertyAssignment(prop)) {
                                if (prop.name.text === 'component') {
                                    componentRef = prop.name
                                }
                                if (prop.name.text === 'loader') {
                                    hasLoader = true
                                }
                            }
                        }

                        if (componentName) {
                            let compType: ComponentType = 'simple'
                            let dataTypeName = '-'
                            let componentFile = sourceFile.fileName

                            if (componentRef) {
                                // Resolve the actual file where the component is defined
                                const componentSymbol =
                                    checker.getSymbolAtLocation(componentRef)
                                if (componentSymbol) {
                                    let resolved = componentSymbol
                                    if (resolved.flags & ts.SymbolFlags.Alias) {
                                        resolved =
                                            checker.getAliasedSymbol(resolved)
                                    }
                                    const declarations =
                                        resolved.getDeclarations()
                                    if (
                                        declarations &&
                                        declarations.length > 0
                                    ) {
                                        componentFile =
                                            declarations[0].getSourceFile()
                                                .fileName
                                    }
                                }

                                const componentType =
                                    checker.getTypeAtLocation(componentRef)
                                const signatures = checker.getSignaturesOfType(
                                    componentType,
                                    ts.SignatureKind.Call
                                )

                                if (signatures.length > 0) {
                                    const propsParam =
                                        signatures[0].getParameters()[0]
                                    if (propsParam) {
                                        const propsType =
                                            checker.getTypeOfSymbolAtLocation(
                                                propsParam,
                                                componentRef
                                            )
                                        compType = detectComponentType(
                                            propsType,
                                            checker
                                        )

                                        const dataProperty =
                                            propsType.getProperty('data')
                                        if (dataProperty) {
                                            const dataType =
                                                checker.getTypeOfSymbolAtLocation(
                                                    dataProperty,
                                                    componentRef
                                                )
                                            const dataSymbol =
                                                dataType.getSymbol()
                                            if (dataSymbol) {
                                                dataTypeName =
                                                    dataSymbol.getName()
                                            } else {
                                                dataTypeName =
                                                    checker.typeToString(
                                                        dataType
                                                    )
                                            }
                                        }
                                    }
                                }
                            }

                            components.push({
                                name: componentName,
                                type: compType,
                                file: path.relative(
                                    process.cwd(),
                                    componentFile
                                ),
                                dataType: dataTypeName,
                                lazy: hasLoader && !componentRef,
                            })
                        }
                    }
                }
            }

            ts.forEachChild(node, visit)
        }

        visit(sourceFile)
    }

    // Filter
    const filtered =
        filter === 'all'
            ? components
            : components.filter((c) => c.type === filter)

    if (filtered.length === 0) {
        console.log(
            filter === 'all'
                ? '[pieui] No components found.'
                : `[pieui] No ${filter} components found.`
        )
        return
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name))

    // Build table
    const headers = ['Name', 'Type', 'Data Type', 'Lazy', 'File']
    const rows = filtered.map((c) => [
        c.name,
        c.type,
        c.dataType,
        c.lazy ? 'yes' : 'no',
        c.file,
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
    console.log(
        `[pieui] Total: ${filtered.length} component${filtered.length === 1 ? '' : 's'}` +
            (filter !== 'all' ? ` (filtered by: ${filter})` : '')
    )
}
