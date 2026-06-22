import { useEffect, useState } from 'react'
import PieCard from '../../components/PieCard'
import { getNativeClientConfig } from '../../platform/nativeConfig'
import { setNativeField, clearNativeField } from '../../platform/nativeFormStore'

/**
 * React Native variant of `DeviceStorageCard`. Persists `data.value` to the
 * host's sync storage adapter (`configureNativeClientSources({ storage })`,
 * e.g. MMKV) under `data.key`, and mirrors it into the native form store under
 * `data.name` so it can participate in Ajax submissions by name. Renders
 * nothing visible.
 */
const DeviceStorageCard = ({ data }: { data: any }) => {
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
        getNativeClientConfig().storage?.setItem?.(key, currentValue)
        setNativeField(name, [currentValue])
        return () => clearNativeField(name)
    }, [key, name, currentValue])

    return (
        <PieCard
            card={'DeviceStorageCard'}
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
                    getNativeClientConfig().storage?.removeItem?.(key)
                    setCurrentValue('')
                },
            }}
        />
    )
}

export default DeviceStorageCard
