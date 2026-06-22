import { useEffect, useState } from 'react'
import PieCard from '../../components/PieCard'
import { getNativeClientConfig } from '../../platform/nativeConfig'
import { setNativeField, clearNativeField } from '../../platform/nativeFormStore'

/**
 * React Native variant of `SessionStorageCard`. Like the device variant but
 * persists to the host's sync `sessionStorage` adapter. Renders nothing visible.
 */
const SessionStorageCard = ({ data }: { data: any }) => {
    const {
        name,
        key,
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
        getNativeClientConfig().sessionStorage?.setItem?.(key, currentValue)
        setNativeField(name, [currentValue])
        return () => clearNativeField(name)
    }, [key, name, currentValue])

    return (
        <PieCard
            card={'SessionStorageCard'}
            data={data}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
            methods={{
                update: ({ value }: { value: string }) => {
                    setCurrentValue(value)
                },
                remove: () => {
                    getNativeClientConfig().sessionStorage?.removeItem?.(key)
                    setCurrentValue('')
                },
            }}
        />
    )
}

export default SessionStorageCard
