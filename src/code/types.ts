import type * as TJS from 'typescript-json-schema'

export const MANIFEST_FILENAME = 'pieui.components.json'
export const REGISTER_FUNCTION = 'registerPieComponent'

export type ComponentType =
    | 'simple'
    | 'complex'
    | 'simple-container'
    | 'complex-container'

export type ListFilter = 'all' | ComponentType

export type ParsedArgs = {
    command: string
    outDir: string
    srcDir: string
    append: boolean
    componentName?: string
    componentType?: ComponentType
    removeComponentName?: string
    listFilter?: ListFilter
}

export type ComponentManifestEntry = {
    card: string
    data: TJS.Definition
}

export type ComponentInfo = {
    name: string
    file: string
    dataTypeName: string
}
