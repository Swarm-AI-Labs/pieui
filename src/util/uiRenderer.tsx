import { ComponentType, createContext } from 'react'
import { SetUiAjaxConfigurationType, UIConfigType } from '../types'

/**
 * Props accepted by any component installed as the active UI renderer.
 *
 * @property uiConfig               The declarative UI configuration to render.
 * @property setUiAjaxConfiguration Optional setter forwarded by Ajax
 *                                  containers so nested cards can update the
 *                                  tree in response to AJAX calls.
 */
export type UIRendererProps = {
    uiConfig: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}

/**
 * React context that exposes the active UI renderer component to nested
 * cards. PieRoot variants populate this so that containers can render new
 * `UIConfigType` subtrees (e.g. after an Ajax update) without importing the
 * renderer module themselves, which would create a circular dependency.
 */
const UIRendererContext = createContext<ComponentType<UIRendererProps> | null>(
    null
)

export default UIRendererContext
