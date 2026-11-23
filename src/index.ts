'use client'

export * from './components'

export { default as UI } from './components/UI'
export { default as UILoading } from './components/UILoading'
export {
    default as UIRendererContext,
    type UIRendererProps,
} from './util/uiRenderer'
export { default as PieRoot } from './components/PieRoot'
export { default as PieBaseRoot } from './components/PieBaseRoot'
export { default as PiePreviewRoot } from './components/PiePreviewRoot'
export type { PiePreviewRootProps } from './components/PiePreviewRoot'
// NOTE: `PieTelegramRoot` (+ `useWebApp`/`useInitData`) moved to the
// `@swarm.ing/pieui/telegram` subpath, and `PieMaxRoot` (+ `useMaxWebApp` &
// friends) moved to `@swarm.ing/pieui/max`. They are platform-specific host
// integrations; splitting them out keeps the main barrel free of Telegram/MAX
// code for apps that don't target those hosts. Import them from their subpath.
export { default as PieCard } from './components/PieCard'
export {
    registerPieComponent,
    getAllRegisteredComponents,
    getRegistrySize,
    registry,
    hasComponent,
    getRegistryEntry,
    getComponentMeta,
    registerMultipleComponents,
    unregisterComponent,
    getLazyComponentNames,
    preloadComponent,
    prefetchLazyComponents,
} from './util/registry'
export { trackLazy } from './util/lazy'
export { loadPieConfig } from './util/loadPieConfig'
export type { LoadPieConfigParams } from './util/loadPieConfig'

export type {
    PieComponentProps,
    PieSimpleComponentProps,
    PieComplexComponentProps,
    PieContainerComponentProps,
    PieComplexContainerComponentProps,
    InputPieSimpleComponentProps,
    InputPieComplexComponentProps,
    InputPieContainerComponentProps,
    InputPieComplexContainerComponentProps,
    PieConfig,
    PieLinkSource,
    UIConfigType,
    SetUiAjaxConfigurationType,
} from './types'

export type { PieQueryOptions } from './components/PieRoot/types'

// Ранний запрос конфига страницы. `buildConfigPrefetchScript` отдаёт готовый
// инлайновый скрипт для `<head>`: он собирает URL тем же `buildContentUrl`,
// что и рут, шлёт куки и не реджектится. См. util/contentRequest.
export {
    buildContentUrl,
    consumeConfigPrefetch,
    PIE_PREFETCH_TIMEOUT_MS,
} from './util/contentRequest'
export type {
    PieConfigPrefetch,
    PieRootKind,
    ContentUrlParams,
    ConsumeConfigPrefetchOptions,
} from './util/contentRequest'
export {
    buildConfigPrefetchScript,
    readConfigPrefetch,
    PIE_CONFIG_PREFETCH_GLOBAL,
} from './util/configPrefetchScript'
export type { ConfigPrefetchScriptParams } from './util/configPrefetchScript'

export {
    useAjaxSubmit,
    useAjaxSubmits,
    discoverAjaxEndpoints,
    readAjaxKey,
    readAjaxKeyAsync,
    parseDepName,
} from './util/ajaxCommonUtils'
export type {
    RetryPolicy,
    DepSource,
    AjaxEndpointConfig,
    AjaxSubmitFn,
    GetAjaxSubmitOptions,
} from './util/ajaxCommonUtils'
export { usePieEmit } from './util/mitt'
export { default as MittContext, getEmitter } from './util/mitt'
export { default as SocketIOContext } from './util/socket'
export { default as CentrifugeIOContext } from './util/centrifuge'
export { default as FallbackContext } from './util/fallback'
export {
    PieConfigContext,
    useOnLinkLost,
    useOnLinkRestored,
    useOnUnauthorized,
} from './util/pieConfig'
// NOTE: `getMittAgentTools` / `usePieMittAgentTools` / `useOpenAIWebRTC` moved
// to the `@swarm.ing/pieui/agent` subpath. They pull in `@openai/agents` (+ the
// OpenAI & MCP SDKs), so keeping them in this main barrel forced every consumer
// to ship the agent stack to the browser. Import them from
// `@swarm.ing/pieui/agent`.
export { cn } from './util/tailwindCommonUtils'
export { PIEBREAK } from './util/pieConfig'
export { submitGlobalForm } from './util/globalForm.ts'
export { pieName } from './util/pieName'
