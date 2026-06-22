'use client'

import { ClientSources } from './types'
import webClientSources from './clientSources.web'
import nativeClientSources from './clientSources.native'

/**
 * Resolves the active {@link ClientSources} implementation at runtime.
 *
 * The library ships pre-bundled (each entry is a single file), so Metro's
 * `.native` extension resolution never sees the platform module — we pick the
 * implementation at runtime instead. React Native sets
 * `navigator.product === 'ReactNative'`; everything else (browser, SSR) uses
 * the DOM implementation, whose methods guard their own `window`/`document`
 * access.
 *
 * Both implementations are dependency-free of each other and of native modules,
 * so bundling both into either entry is harmless — only the selected one ever
 * executes.
 */
const isReactNative =
    typeof navigator !== 'undefined' &&
    (navigator as { product?: string }).product === 'ReactNative'

const clientSources: ClientSources = isReactNative
    ? nativeClientSources
    : webClientSources

export default clientSources
