import { useEffect, useState } from 'react'
import PieCard from '../../components/PieCard'
import { setNativeField, clearNativeField } from '../../platform/nativeFormStore'

/**
 * React Native variant of `HiddenCard`. There is no hidden `<input>` on native,
 * so the value is published to the native form store under `data.name` — a
 * plain dep name then resolves to it exactly as it would from a hidden input on
 * web. Renders nothing visible.
 */
const HiddenCard = ({ data }: { data: any }) => {
    const {
        name,
        value,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const [currentValue, setCurrentValue] = useState(value)

    useEffect(() => {
        setCurrentValue(value)
    }, [value])

    useEffect(() => {
        setNativeField(name, [currentValue])
        return () => clearNativeField(name)
    }, [name, currentValue])

    return (
        <PieCard
            card={'HiddenCard'}
            data={data}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
            methods={{
                update: ({ value }: { value: string }) => {
                    setCurrentValue(value)
                },
            }}
        />
    )
}

export default HiddenCard
