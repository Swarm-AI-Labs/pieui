import type * as TJS from 'typescript-json-schema'

export const MANIFEST_FILENAME = 'pieui.components.json'
export const REGISTER_FUNCTION = 'registerPieComponent'

export type ComponentType =
    | 'simple'
    | 'complex'
    | 'simple-container'
    | 'complex-container'

export type ListFilter = 'all' | ComponentType
export type CardAction =
    | 'add'
    | 'list'
    | 'pull'
    | 'view'
    | 'remove'
    | 'list-events'
    | 'add-event'
    | 'remote'
    | 'dump-metadata'
    | 'check-sync'
    | 'add-story'
export type CardRemoteAction =
    | 'push'
    | 'pull'
    | 'list'
    | 'remove'
    | 'history'
    | 'public'
    | 'private'
export type PageAction = 'add' | 'view' | 'ajax'
export type PageAjaxAction = 'add' | 'remove'

export type ParsedArgs = {
    command: string
    outDir: string
    srcDir: string
    append: boolean
    componentName?: string
    createAppName?: string
    componentType?: ComponentType
    eventName?: string
    listFilter?: ListFilter
    cardAction?: CardAction
    cardAjax?: boolean
    cardIo?: boolean
    cardAddFrom?: string
    cardRemoteAction?: CardRemoteAction
    cardPullRef?: string
    remoteUserId?: string
    remoteProject?: string
    pageAction?: PageAction
    pagePath?: string
    pageName?: string
    pageAjaxAction?: PageAjaxAction
    pageAjaxHandler?: string
    historyPage?: number
    historyPerPage?: number
    historyFrom?: number
    historyTo?: number
    selfUpgradePm?: string
    dumpMetadataOut?: string
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

export type JSONSchema = Record<string, unknown>

export type PieFileEntry = {
    /** Path relative to the components dir (`piecomponents/` on TS,
     *  `pages/components/` on Python). E.g. `BoxCard/index.ts`,
     *  `box_card.py`. */
    path: string
    /** Full text contents of the file, utf-8. */
    content: string
}

export type PieMetadata = {
    name: string
    files: PieFileEntry[]
    packages: string[]
    relativeImports: string[]
    events: string[]
    propsSchema: JSONSchema | null
    propsCode: string
    description: string
    eventsPropsSchema: Record<string, JSONSchema>
    eventsPropsCode: Record<string, string>
    inputPropsCode: string | null
    inputPropsSchema: JSONSchema | null
    ajaxList: string[]
}
