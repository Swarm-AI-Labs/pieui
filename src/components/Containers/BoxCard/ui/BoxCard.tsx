import { BoxCardData } from '../types'
import UI from '../../../UI'
import { SetUiAjaxConfigurationType, UIConfigType } from '../../../../types'
import PieCard from '../../../PieCard'
import { MouseEventHandler, useContext } from 'react'
import NavigateContext from '../../../../util/navigate.ts'
import UIRendererContext from '../../../../util/uiRenderer'

const BoxCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: {
    data: BoxCardData
    content: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const { name, url, sx } = data

    const navigate = useContext(NavigateContext)
    const Renderer = useContext(UIRendererContext) ?? UI

    const routeChange: MouseEventHandler<HTMLDivElement> = (event) => {
        if (url) {
            event.stopPropagation()
            const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
            if (isExternal) {
                window.location.href = url
            } else {
                navigate?.(url)
            }
        }
    }

    return (
        <PieCard card={name} data={data}>
            <div style={sx} id={name} onClick={routeChange}>
                <Renderer
                    setUiAjaxConfiguration={setUiAjaxConfiguration}
                    uiConfig={content}
                />
            </div>
        </PieCard>
    )
}

export default BoxCard
