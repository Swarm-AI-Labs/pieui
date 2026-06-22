'use client'

/**
 * React Native entry for PieUI (`@swarm.ing/pieui/native`).
 *
 * Exposes the platform-agnostic core (registry, dynamic UI renderer, PieCard,
 * real-time contexts, Ajax helpers) plus native-specific wiring. It deliberately
 * does NOT export the DOM container/leaf cards (BoxCard, HTMLEmbedCard,
 * IOEventsCard, …) — those render HTML host elements or pull browser-only
 * libraries. On native the host registers its own React Native leaf components
 * with `registerPieComponent` and renders them through `UI` / `PieCard`.
 *
 * Bundlers that understand the `.native` extension (Metro) resolve the platform
 * layer to `clientSources.native.ts` automatically. Wire the host's storage /
 * route / form sources once at startup via `configureNativeClientSources`.
 */

// Native roots & wiring
export { default as PieNativeRoot } from './PieNativeRoot'
export { default as PieBaseRoot } from '../components/PieBaseRoot'
export {
    configureNativeClientSources,
    getNativeClientConfig,
    resetNativeClientSources,
    type NativeClientConfig,
    type NativeStorageAdapter,
} from '../platform/nativeConfig'

// Dynamic UI rendering core
export { default as UI } from '../components/UI'
export { default as UILoading } from '../components/UILoading'
export {
    default as UIRendererContext,
    type UIRendererProps,
} from '../util/uiRenderer'
export { default as PieCard } from '../components/PieCard'

// Component registry
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
} from '../util/registry'
export { trackLazy } from '../util/lazy'

// Ajax helpers (platform-routed)
export {
    useAjaxSubmit,
    readAjaxKey,
    readAjaxKeyAsync,
    parseDepName,
} from '../util/ajaxCommonUtils'
export type { RetryPolicy, DepSource } from '../util/ajaxCommonUtils'
export { submitGlobalForm } from '../util/globalForm'

// Real-time + config contexts
export { usePieEmit } from '../util/mitt'
export { default as MittContext, getEmitter } from '../util/mitt'
export { default as SocketIOContext } from '../util/socket'
export { default as CentrifugeIOContext } from '../util/centrifuge'
export { default as FallbackContext } from '../util/fallback'
export { PieConfigContext, PIEBREAK } from '../util/pieConfig'
export { pieName } from '../util/pieName'

// Types
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
} from '../types'
export type { PieRootProps, PieQueryOptions } from '../components/PieRoot/types'
export type { PieBaseRootProps } from '../components/PieBaseRoot/types'
