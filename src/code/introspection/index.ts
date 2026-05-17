/**
 * Introspection algorithms for `pieui card dump-metadata` and `check-sync`.
 *
 * Each submodule documents its inputs, assumptions, output shape, and
 * algorithmic approach via per-function JSDoc.
 *
 * Public surface:
 *
 *   schemaContext:
 *     - createSchemaContext(files): SchemaContext
 *     - findTypeDeclaration(program, checker, name): { symbol, declaration } | null
 *     - buildSchemaForType(ctx, typeName): JSONSchema | null
 *
 *   typeToSchema:
 *     - typeToSchema(tsType, checker): JSONSchema
 *
 *   collectFiles:
 *     - collectComponentFiles(componentDir): string[]
 *
 *   extractImports:
 *     - extractImports(files, cwd?): { relativeImports, packages }
 *
 *   extractEvents:
 *     - extractEvents(files): string[]    // strict: throws on non-literal
 *
 *   extractEventsPayloads:
 *     - followIdentifierToFunction(ctx, ident): Parameter | null
 *     - schemaForParameter(ctx, param, sourceFile): { code, schema }
 *     - extractEventsPayloads(ctx, files, events): { code, schema }
 *
 *   findDataType:
 *     - findComponentDataTypeForName(ctx, name): { typeName, declaration } | null
 *     - extractAjaxList(declaration): string[]
 *
 *   findInputType:
 *     - findStoredAttributeType(ctx, files): { typeName, declaration } | null
 */

export { IntrospectionError } from './errors'
export {
    createSchemaContext,
    findTypeDeclaration,
    buildSchemaForType,
    type SchemaContext,
} from './schemaContext'
export { typeToSchema } from './typeToSchema'
export { collectComponentFiles } from './collectFiles'
export { extractImports, type ImportSplit } from './extractImports'
export { extractEvents } from './extractEvents'
export {
    followIdentifierToFunction,
    schemaForParameter,
    extractEventsPayloads,
} from './extractEventsPayloads'
export {
    findComponentDataTypeForName,
    extractAjaxList,
} from './findDataType'
export { findStoredAttributeType } from './findInputType'
