import fs from 'fs'
import path from 'path'
import { ts, TJS } from '../ts'
import {
    ComponentInfo,
    ComponentManifestEntry,
    MANIFEST_FILENAME,
} from '../types'
import { findComponentRegistrations } from '../scan'
import { patchSchemaForType } from '../schema'

export const postbuildCommand = async (
    srcDir: string,
    outDir: string,
    append: boolean
) => {
    const components = findComponentRegistrations(srcDir)

    if (components.length === 0) {
        console.log('[pieui] Warning: No components with data types found!')
    }

    // Get all unique files that contain components
    const cliSchemaPath = path.join(__dirname, 'cli-schema.d.ts')
    const uniqueFiles = [
        cliSchemaPath,
        ...new Set(components.map((c) => c.file)),
    ]

    console.log('[pieui] Creating TypeScript program for schema generation...')

    // Create program with all files
    const program = TJS.getProgramFromFiles(uniqueFiles, {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
    })

    const checker = program.getTypeChecker()

    const findTypeSymbol = (component: ComponentInfo): any => {
        const sourceFile = program.getSourceFile(component.file)
        if (sourceFile) {
            let found: any

            const visit = (node: any) => {
                if (
                    ts.isInterfaceDeclaration(node) ||
                    ts.isTypeAliasDeclaration(node)
                ) {
                    if (node.name.text === component.dataTypeName) {
                        found = checker.getSymbolAtLocation(node.name)
                        return
                    }
                }
                ts.forEachChild(node, visit)
            }

            visit(sourceFile)

            if (found) {
                return found
            }

            const symbols = checker.getSymbolsInScope(
                sourceFile,
                ts.SymbolFlags.Type
            )
            const match = symbols.find(
                (symbol) => symbol.getName() === component.dataTypeName
            )
            if (match) {
                return match
            }
        }

        return checker.resolveName(
            component.dataTypeName,
            undefined,
            ts.SymbolFlags.Type,
            false
        ) as any
    }

    // Create schema generator
    const generator = TJS.buildGenerator(program, {
        required: true,
        strictNullChecks: true,
        excludePrivate: true,
        ref: false,
        aliasRef: false,
        topRef: false,
        noExtraProps: true,
        ignoreErrors: true,
    })

    if (!generator) {
        throw new Error('Failed to create JSON Schema generator')
    }

    const entries: ComponentManifestEntry[] = []

    // Generate schema for each component
    for (const component of components) {
        console.log(
            `[pieui] Generating schema for ${component.name} (type: ${component.dataTypeName})...`
        )

        try {
            const schema = generator.getSchemaForSymbol(component.dataTypeName)

            if (schema) {
                const typeSymbol = findTypeSymbol(component)
                if (typeSymbol) {
                    const declaredType =
                        checker.getDeclaredTypeOfSymbol(typeSymbol)
                    patchSchemaForType(declaredType, schema, checker)
                }
                entries.push({
                    card: component.name,
                    data: schema,
                })
                console.log(`[pieui]   ✓ Schema generated successfully`)
            } else {
                console.log(`[pieui]   ✗ Could not generate schema`)
                entries.push({
                    card: component.name,
                    data: {
                        type: 'object',
                        additionalProperties: true,
                    },
                })
            }
        } catch (error) {
            console.error(
                `[pieui]   ✗ Error: ${error instanceof Error ? error.message : error}`
            )
            entries.push({
                card: component.name,
                data: {
                    type: 'object',
                    additionalProperties: true,
                },
            })
        }
    }

    // Try to load existing manifest from pieui library if append mode is enabled
    let existingEntries: ComponentManifestEntry[] = []

    if (append) {
        console.log(
            '[pieui] Append mode enabled - loading existing pieui components'
        )

        const nodeModulesPath = path.join(
            process.cwd(),
            'node_modules',
            '@piedata',
            'pieui',
            'dist',
            MANIFEST_FILENAME
        )

        if (fs.existsSync(nodeModulesPath)) {
            try {
                const existingManifest = fs.readFileSync(
                    nodeModulesPath,
                    'utf8'
                )
                existingEntries = JSON.parse(existingManifest)
                console.log(
                    `[pieui] Loaded ${existingEntries.length} existing components from pieui library at ${nodeModulesPath}`
                )
            } catch (error) {
                console.error(
                    `[pieui] Error reading manifest from ${nodeModulesPath}:`,
                    error
                )
            }
        } else {
            console.log(
                `[pieui] No existing pieui manifest found at ${nodeModulesPath}`
            )
        }
    } else {
        console.log(
            '[pieui] Append mode disabled - only including components from current project'
        )
    }

    // Merge existing and new entries
    const componentMap = new Map<string, ComponentManifestEntry>()

    for (const entry of existingEntries) {
        componentMap.set(entry.card, entry)
    }

    for (const entry of entries) {
        componentMap.set(entry.card, entry)
    }

    const mergedEntries = Array.from(componentMap.values())

    // Write manifest
    const resolvedOutDir = path.resolve(process.cwd(), outDir)
    fs.mkdirSync(resolvedOutDir, { recursive: true })
    const manifestPath = path.join(resolvedOutDir, MANIFEST_FILENAME)
    fs.writeFileSync(
        manifestPath,
        JSON.stringify(mergedEntries, null, 2),
        'utf8'
    )

    console.log(`[pieui] Component manifest saved to ${manifestPath}`)
    console.log(
        `[pieui] Total components: ${mergedEntries.length} (${existingEntries.length} from pieui, ${entries.length} new/updated)`
    )
}
