'use client'

import PieBaseRoot from '../components/PieBaseRoot'
import { PieBaseRootProps } from '../components/PieBaseRoot/types'

/**
 * React Native root for PieUI. Behaves exactly like {@link PieBaseRoot} but
 * never renders the implicit `<form id="piedata_global_form">` wrapper — there
 * is no HTML form on native, so the global "submit" is handled by the platform
 * `ClientSources` implementation instead (wire it via
 * {@link configureNativeClientSources}).
 *
 * The host registers its own React Native leaf components with
 * `registerPieComponent` and renders the server-driven tree through `UI` /
 * `PieCard` inside this root.
 */
const PieNativeRoot = (props: PieBaseRootProps) => {
    return <PieBaseRoot {...props} disableGlobalForm />
}

export default PieNativeRoot
