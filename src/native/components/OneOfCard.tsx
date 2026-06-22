import { useContext } from 'react'
import { View } from 'react-native'
import { SetUiAjaxConfigurationType, UIConfigType } from '../../types'
import PieCard from '../../components/PieCard'
import UI from '../../components/UI'
import UIRendererContext from '../../util/uiRenderer'

/**
 * React Native variant of `OneOfCard`. Renders its child configs inside a
 * `View` (replacing the web `<div>`).
 */
const OneOfCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: {
    data: any
    content: UIConfigType[]
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const { name, sx } = data
    const Renderer = useContext(UIRendererContext) ?? UI
    return (
        <PieCard card={name} data={data}>
            <View style={sx}>
                {content.map((obj: UIConfigType, i: number) => (
                    <Renderer
                        key={`children-${i}`}
                        uiConfig={obj}
                        setUiAjaxConfiguration={setUiAjaxConfiguration}
                    />
                ))}
            </View>
        </PieCard>
    )
}

export default OneOfCard
