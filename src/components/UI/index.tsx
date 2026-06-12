'use client'

import { UIConfigType, SetUiAjaxConfigurationType } from '../../types'
import { getRegistryEntry } from '../../util/registry'
import { useContext, ReactNode, memo } from 'react'
import FallbackContext from '../../util/fallback'
import LazyErrorContext from '../../util/lazyError'
import LazyBoundary from '../LazyBoundary'
import { useIsRenderingLogEnabled } from '../../util/pieConfig'

function UI({
    uiConfig,
    setUiAjaxConfiguration,
}: {
    uiConfig: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) {
    const Fallback: ReactNode = useContext(FallbackContext)
    const onError = useContext(LazyErrorContext)
    const renderingLogEnabled = useIsRenderingLogEnabled()

    if (renderingLogEnabled) {
        console.log('[UI] Rendering component:', uiConfig.card)
        console.log('[UI] Component data:', uiConfig.data)
        console.log('[UI] Component content:', uiConfig.content)
        console.log(
            '[UI] Has setUiAjaxConfiguration:',
            !!setUiAjaxConfiguration
        )
    }

    const entry = getRegistryEntry(uiConfig.card)
    if (!entry?.component) {
        if (renderingLogEnabled) {
            console.warn(
                `[UI] Component not found in registry: ${uiConfig.card}`
            )
            console.log('[UI] Returning fallback component')
        }
        return Fallback
    }

    if (renderingLogEnabled) {
        console.log('[UI] Found component in registry:', {
            name: entry.name,
            isLazy: entry.isLazy,
            hasMetadata: !!entry.metadata,
        })
    }

    const Component = entry.component

    const node = (
        <Component
            data={uiConfig.data}
            content={uiConfig.content}
            setUiAjaxConfiguration={setUiAjaxConfiguration}
        />
    )

    if (entry.isLazy) {
        if (renderingLogEnabled) {
            console.log(
                '[UI] Rendering lazy component with Suspense:',
                entry.name
            )
        }
        return (
            <LazyBoundary
                name={entry.name}
                fallback={entry.fallback ? <entry.fallback /> : Fallback}
                onError={onError}
            >
                {node}
            </LazyBoundary>
        )
    }

    if (renderingLogEnabled) {
        console.log('[UI] Rendering component directly:', entry.name)
    }

    return node
}

export default memo(UI)
