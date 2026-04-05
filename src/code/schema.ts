import { ts } from './ts'

export const isCssPropertiesType = (type: any, checker: any): boolean => {
    if (type.isUnion()) {
        return type.types.some((unionType: any) =>
            isCssPropertiesType(unionType, checker)
        )
    }

    const aliasSymbol = type.aliasSymbol
    if (aliasSymbol && aliasSymbol.getName() === 'CSSProperties') {
        return true
    }

    const symbol = type.getSymbol()
    if (symbol && symbol.getName() === 'CSSProperties') {
        return true
    }

    const typeText = checker.typeToString(type)
    if (typeText.includes('CSSProperties')) {
        return true
    }

    if (symbol) {
        const declarations = symbol.getDeclarations()
        if (!declarations || declarations.length === 0) {
            return false
        }

        return declarations.some((declaration: any) => {
            const fileName = declaration.getSourceFile().fileName
            return fileName.includes('react') || fileName.includes('csstype')
        })
    }

    return false
}

export const schemaForIndexType = (
    type: any,
    checker: any
): Record<string, any> => {
    const normalizedType = type.getNonNullableType
        ? type.getNonNullableType()
        : type

    if (normalizedType.flags & ts.TypeFlags.StringLike) {
        return { type: 'string' }
    }

    if (normalizedType.flags & ts.TypeFlags.NumberLike) {
        return { type: 'number' }
    }

    if (normalizedType.flags & ts.TypeFlags.BooleanLike) {
        return { type: 'boolean' }
    }

    if (normalizedType.flags & ts.TypeFlags.BigIntLike) {
        return { type: 'integer' }
    }

    if (isCssPropertiesType(normalizedType, checker)) {
        return { type: 'object', additionalProperties: {} }
    }

    if (normalizedType.isUnion()) {
        return {
            anyOf: normalizedType.types.map((unionType: any) =>
                schemaForIndexType(unionType, checker)
            ),
        }
    }

    if (checker.isArrayType(normalizedType)) {
        const elementType = checker.getElementTypeOfArrayType(normalizedType)
        if (elementType) {
            return {
                type: 'array',
                items: schemaForIndexType(elementType, checker),
            }
        }
    }

    return {}
}

export const patchSchemaForType = (
    type: any,
    schema: Record<string, any>,
    checker: any,
    visited: Set<number> = new Set()
): void => {
    if (!schema || typeof schema !== 'object') {
        return
    }

    const normalizedType = type.getNonNullableType
        ? type.getNonNullableType()
        : type
    if (visited.has(normalizedType.id)) {
        return
    }
    visited.add(normalizedType.id)

    if (isCssPropertiesType(normalizedType, checker)) {
        schema.type = 'object'
        schema.additionalProperties = {}
        delete schema.properties
        delete schema.required
        return
    }

    const stringIndexType = normalizedType.getStringIndexType?.()
    if (stringIndexType) {
        const indexSchema = schemaForIndexType(stringIndexType, checker)
        schema.type = 'object'
        schema.additionalProperties = indexSchema

        if (schema.properties && Object.keys(schema.properties).length === 0) {
            delete schema.properties
            delete schema.required
        }
    }

    if (checker.isTupleType(normalizedType)) {
        const elementTypes = checker.getTypeArguments(normalizedType as any)
        if (schema.items && Array.isArray(schema.items)) {
            for (
                let i = 0;
                i < schema.items.length && i < elementTypes.length;
                i += 1
            ) {
                patchSchemaForType(
                    elementTypes[i],
                    schema.items[i],
                    checker,
                    visited
                )
            }
        }
        return
    }

    if (checker.isArrayType(normalizedType)) {
        const elementType = checker.getElementTypeOfArrayType(normalizedType)
        if (elementType && schema.items && !Array.isArray(schema.items)) {
            patchSchemaForType(elementType, schema.items, checker, visited)
        }
        return
    }

    if (normalizedType.isUnion() && Array.isArray(schema.anyOf)) {
        const unionTypes = normalizedType.types
        for (
            let i = 0;
            i < schema.anyOf.length && i < unionTypes.length;
            i += 1
        ) {
            patchSchemaForType(unionTypes[i], schema.anyOf[i], checker, visited)
        }
        return
    }

    if (normalizedType.isIntersection() && Array.isArray(schema.allOf)) {
        const intersectionTypes = normalizedType.types
        for (
            let i = 0;
            i < schema.allOf.length && i < intersectionTypes.length;
            i += 1
        ) {
            patchSchemaForType(
                intersectionTypes[i],
                schema.allOf[i],
                checker,
                visited
            )
        }
        return
    }

    const properties = checker.getPropertiesOfType(normalizedType)
    if (schema.properties && properties.length > 0) {
        for (const property of properties) {
            const propertyName = property.getName()
            const propertySchema = schema.properties[propertyName]
            if (!propertySchema) {
                continue
            }
            const declaration =
                property.valueDeclaration ?? property.declarations?.[0]
            if (!declaration) {
                continue
            }
            const propertyType = checker.getTypeOfSymbolAtLocation(
                property,
                declaration
            )
            patchSchemaForType(propertyType, propertySchema, checker, visited)
        }
    }
}
