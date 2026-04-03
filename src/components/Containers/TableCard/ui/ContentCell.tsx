import { useContext } from 'react'
import { SetUiAjaxConfigurationType, UIConfigType } from '../../../../types'
import UI from '../../../UI'
import UIRendererContext from '../../../../util/uiRenderer'

export const ContentCell = ({
    data,
    setUiAjaxConfiguration,
}: {
    data: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const Renderer = useContext(UIRendererContext) ?? UI
    return (
        <Renderer
            uiConfig={data}
            setUiAjaxConfiguration={setUiAjaxConfiguration}
        />
    )
}
