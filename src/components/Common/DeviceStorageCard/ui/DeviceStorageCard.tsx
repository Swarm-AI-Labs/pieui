import { useEffect, useState } from 'react'
import { DeviceStorageCardProps } from '../types'
import PieCard from '../../../PieCard'

const DeviceStorageCard = ({ data }: DeviceStorageCardProps) => {
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
        if (typeof window === 'undefined') return
        localStorage.setItem(key, currentValue)
    }, [key, currentValue])

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
                    localStorage.removeItem(key)
                    setCurrentValue('')
                },
            }}
        >
            <input type="hidden" id={name} name={name} value={currentValue} />
        </PieCard>
    )
}

export default DeviceStorageCard
