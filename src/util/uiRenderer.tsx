import { ComponentType, createContext } from 'react'
import { SetUiAjaxConfigurationType, UIConfigType } from '../types'

export type UIRendererProps = {
    uiConfig: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}

const UIRendererContext = createContext<ComponentType<UIRendererProps> | null>(
    null
)

export default UIRendererContext