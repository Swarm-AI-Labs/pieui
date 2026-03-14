import { SetUiAjaxConfigurationType, UIConfigType } from '../../../../types'
import { UI } from '../../../UI'

export const ContentCell = ({
    data,
    setUiAjaxConfiguration,
}: {
    data: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    return (
        <UI uiConfig={data} setUiAjaxConfiguration={setUiAjaxConfiguration} />
    )
}
