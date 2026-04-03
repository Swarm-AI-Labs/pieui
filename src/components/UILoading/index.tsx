'use client'

import { UIConfigType, SetUiAjaxConfigurationType } from '../../types'
import { getRegistryEntry } from '../../util/registry'
import { Suspense, useContext, ReactNode } from 'react'
import FallbackContext from '../../util/fallback'
import { isRenderingLogEnabled } from '../../util/pieConfig'

function UILoading({
    uiConfig,
    setUiAjaxConfiguration,
}: {
    uiConfig: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) {
    const Fallback: ReactNode = useContext(FallbackContext)
    const renderingLogEnabled = isRenderingLogEnabled()

    if (renderingLogEnabled) {
        console.log('[UILoading] Rendering fallback for:', uiConfig.card)
        console.log('[UILoading] Component data:', uiConfig.data)
        console.log('[UILoading] Component content:', uiConfig.content)
        console.log(
            '[UILoading] Has setUiAjaxConfiguration:',
            !!setUiAjaxConfiguration
        )
    }

    const entry = getRegistryEntry(uiConfig.card)
    if (!entry?.component) {
        if (renderingLogEnabled) {
            console.warn(
                `[UILoading] Component not found in registry: ${uiConfig.card}`
            )
            console.log('[UILoading] Returning fallback component')
        }
        return Fallback
    }

    if (renderingLogEnabled) {
        console.log('[UILoading] Found component in registry:', {
            name: entry.name,
            isLazy: entry.isLazy,
            hasMetadata: !!entry.metadata,
            hasFallback: !!entry.fallback,
        })
    }

    if (entry.fallback) {
        if (renderingLogEnabled) {
            console.log('[UILoading] Rendering fallback for:', entry.name)
        }
        return <>{entry.fallback}</>
    }

    if (renderingLogEnabled) {
        console.log(
            '[UILoading] No fallback, rendering full component:',
            entry.name
        )
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
        return (
            <Suspense key={`${entry.name}`} fallback={Fallback}>
                {node}
            </Suspense>
        )
    }

    return node
}

export default UILoading
