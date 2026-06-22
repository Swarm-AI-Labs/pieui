import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import PieCard from '../../components/PieCard'

/** Best-effort plain-text rendering of HTML — strips tags & collapses space. */
const stripHtml = (html: string): string =>
    (html ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

/**
 * React Native variant of `HTMLEmbedCard`. React Native cannot render arbitrary
 * HTML, so this shows the markup as stripped plain text inside a `<Text>` and
 * supports the `update` event. The web variant's WebRTC/AI streaming is
 * browser-only and intentionally omitted here.
 */
const HTMLEmbedCard = ({ data }: { data: any }) => {
    const {
        html,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const [valueCurrent, setValueCurrent] = useState(html)

    useEffect(() => {
        setValueCurrent(html)
    }, [html])

    return (
        <PieCard
            card="HTMLEmbedCard"
            data={data}
            methods={{
                update: (event: any) => setValueCurrent(event.value),
            }}
            useCentrifugeSupport={useCentrifugeSupport}
            useSocketioSupport={useSocketioSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
        >
            <Text>{stripHtml(valueCurrent)}</Text>
        </PieCard>
    )
}

export default HTMLEmbedCard
