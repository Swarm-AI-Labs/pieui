import { useContext } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { SetUiAjaxConfigurationType, UIConfigType } from '../../types'
import PieCard from '../../components/PieCard'
import UI from '../../components/UI'
import NavigateContext from '../../util/navigate'
import UIRendererContext from '../../util/uiRenderer'

const isExternal = (url: string) =>
    /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)

/**
 * React Native variant of `BoxCard`. Renders its child config inside a `View`
 * (a `Pressable` when `data.url` is set), routing external URLs through
 * `Linking` and internal ones through `NavigateContext`.
 */
const BoxCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: {
    data: any
    content: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const { name, url, sx } = data
    const navigate = useContext(NavigateContext)
    const Renderer = useContext(UIRendererContext) ?? UI

    const onPress = () => {
        if (!url) return
        if (isExternal(url)) Linking.openURL(url).catch(() => {})
        else navigate?.(url)
    }

    const inner = (
        <Renderer
            setUiAjaxConfiguration={setUiAjaxConfiguration}
            uiConfig={content}
        />
    )

    return (
        <PieCard card={name} data={data}>
            {url ? (
                <Pressable onPress={onPress} style={sx}>
                    {inner}
                </Pressable>
            ) : (
                <View style={sx}>{inner}</View>
            )}
        </PieCard>
    )
}

export default BoxCard
