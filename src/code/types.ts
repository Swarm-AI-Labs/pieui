import type * as TJS from 'typescript-json-schema'

export const MANIFEST_FILENAME = 'pieui.components.json'
export const REGISTER_FUNCTION = 'registerPieComponent'

export type ComponentType =
    | 'simple'
    | 'complex'
    | 'simple-container'
    | 'complex-container'

export type ListFilter = 'all' | ComponentType
export type CardAction = 'add' | 'remote'
export type CardRemoteAction = 'push' | 'pull' | 'list' | 'remove'
export type PageAction = 'add'

export type ParsedArgs = {
    command: string
    outDir: string
    srcDir: string
    append: boolean
    componentName?: string
    createAppName?: string
    componentType?: ComponentType
    eventName?: string
    removeComponentName?: string
    listFilter?: ListFilter
    cardAction?: CardAction
    cardAjax?: boolean
    cardIo?: boolean
    cardRemoteAction?: CardRemoteAction
    remoteUserId?: string
    remoteProject?: string
    pageAction?: PageAction
    pagePath?: string
}

export type CardScaffoldOptions = {
    ajax?: boolean
    io?: boolean
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
