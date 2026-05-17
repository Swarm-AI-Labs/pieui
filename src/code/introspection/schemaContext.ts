/**
 * TypeScript compiler context for schema generation.
 *
 * Wraps `typescript-json-schema`'s program/checker/generator triple so
 * other introspection helpers can resolve named types into JSON Schemas
 * without each carrying its own copy of the compiler setup.
 *
 * The CLI's `cli-schema.d.ts` is always injected as the first file so
 * built-in helper types are visible to the generator.
 */

import path from 'node:path'
import { ts, TJS } from '../ts'
import { patchSchemaForType } from '../schema'
import type { JSONSchema } from '../types'

export type SchemaContext = {
    program: any
    checker: any
    generator: any
}

const DEFAULT_COMPILER_OPTIONS = (): any => ({
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
})

/**
 * Build a `SchemaContext` from a list of source files.
 *
 * ASSUMES:
 *   - `files` are absolute paths (`.ts` or `.tsx`).
 *   - The TS compiler can read them with the default options below.
 *
 * RETURNS: an opaque context that callers pass to
 * `findTypeDeclaration` and `buildSchemaForType`. The generator inside
 * comes from `typescript-json-schema` and respects `strictNullChecks`,
 * `noExtraProps: true`, and `ignoreErrors: true` (so partially-broken
 * files still yield best-effort schemas).
 */
export const createSchemaContext = (files: string[]): SchemaContext => {
    const cliSchemaPath = path.join(
        __dirname,
        '..',
        'commands',
        'cli-schema.d.ts'
    )
    const uniqueFiles = Array.from(new Set([cliSchemaPath, ...files]))
    const program = TJS.getProgramFromFiles(
        uniqueFiles,
        DEFAULT_COMPILER_OPTIONS()
    )
    const checker = program.getTypeChecker()
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
    return { program, checker, generator }
}

/**
 * Find an interface or type-alias declaration by name across all
 * source files in the program.
 *
 * ASSUMES: `program` was built by `createSchemaContext` (i.e. has the
 * relevant files loaded).
 *
 * RETURNS: `{ symbol, declaration }` for the first matching
 * InterfaceDeclaration or TypeAliasDeclaration; `null` if not found.
 *
 * ALGORITHM: linear walk over every non-`.d.ts` source file, DFS into
 * the AST. Returns at first hit; declaration files are skipped because
 * we want user-declared types only.
 */
export const findTypeDeclaration = (
    program: any,
    checker: any,
    typeName: string
): { symbol: any; declaration: any } | null => {
    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue
        let found: { symbol: any; declaration: any } | null = null
        const visit = (node: any): void => {
            if (found) return
            if (
                (ts.isInterfaceDeclaration(node) ||
                    ts.isTypeAliasDeclaration(node)) &&
                node.name.text === typeName
            ) {
                const symbol = checker.getSymbolAtLocation(node.name)
                if (symbol) {
                    found = { symbol, declaration: node }
                }
                return
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
        if (found) return found
    }
    return null
}

/**
 * Build a JSON Schema for a named TS type (interface or type alias).
 *
 * ASSUMES: `typeName` is the identifier name of a declared type
 * reachable from any source file in the context.
 *
 * RETURNS:
 *   - the JSON Schema produced by `typescript-json-schema`, then
 *     post-processed by `patchSchemaForType` so that special types like
 *     `CSSProperties` collapse to `{ type: "object", additionalProperties: true }`.
 *   - `null` if the generator fails or the type isn't found.
 *
 * ALGORITHM:
 *   1. `generator.getSchemaForSymbol(typeName)` produces the raw schema.
 *   2. `findTypeDeclaration` locates the declaration node so the
 *      post-processor can walk it with the checker.
 *   3. `patchSchemaForType` mutates the schema to fix known
 *      `typescript-json-schema` quirks (CSSProperties, etc.).
 */
export const buildSchemaForType = (
    ctx: SchemaContext,
    typeName: string
): JSONSchema | null => {
    try {
        const schema = ctx.generator.getSchemaForSymbol(typeName) as
            | JSONSchema
            | undefined
        if (!schema) return null
        const decl = findTypeDeclaration(ctx.program, ctx.checker, typeName)
        if (decl) {
            const declaredType = ctx.checker.getDeclaredTypeOfSymbol(
                decl.symbol
            )
            patchSchemaForType(declaredType, schema, ctx.checker)
        }
        return schema
    } catch {
        return null
    }
}
