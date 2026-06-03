'use client'

export * from './components'

export { default as UI } from './components/UI'
export { default as UILoading } from './components/UILoading'
export {
    default as UIRendererContext,
    type UIRendererProps,
} from './util/uiRenderer'
export { default as PieRoot } from './components/PieRoot'
export { default as PieTelegramRoot } from './components/PieTelegramRoot'
export { default as PieBaseRoot } from './components/PieBaseRoot'
export { default as PieMaxRoot } from './components/PieMaxRoot'
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
} from './util/registry'

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
    UIConfigType,
    SetUiAjaxConfigurationType,
} from './types'

export type { PieQueryOptions } from './components/PieRoot/types'

export { useAjaxSubmit, readAjaxKey } from './util/ajaxCommonUtils'
export type { RetryPolicy } from './util/ajaxCommonUtils'
export { usePieEmit } from './util/mitt'
export { default as MittContext, getEmitter } from './util/mitt'
export { default as SocketIOContext } from './util/socket'
export { default as CentrifugeIOContext } from './util/centrifuge'
export { default as FallbackContext } from './util/fallback'
export { PieConfigContext } from './util/pieConfig'
// NOTE: `getMittAgentTools` / `usePieMittAgentTools` moved to the
// `@swarm.ing/pieui/agent` subpath. They pull in `@openai/agents` (+ the OpenAI
// & MCP SDKs), so keeping them in this main barrel forced every consumer to
// ship the agent stack to the browser. Import them from `@swarm.ing/pieui/agent`.
export {
    default as useOpenAIWebRTC,
    type OpenAIEvent,
    type UseOpenAIWebRTCReturn,
} from './util/useOpenAIWebRTC'
export { cn } from './util/tailwindCommonUtils'
export { PIEBREAK } from './util/pieConfig'
export { submitGlobalForm } from './util/globalForm.ts'
export { pieName } from './util/pieName'
export { useWebApp } from './util/useWebApp'
export { useMaxWebApp } from './util/useMaxWebApp'
