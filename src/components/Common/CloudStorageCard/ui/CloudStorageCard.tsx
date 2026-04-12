import { useEffect, useState } from 'react'
import { CloudStorageCardProps } from '../types'
import PieCard from '../../../PieCard'

const CloudStorageCard = ({ data }: CloudStorageCardProps) => {
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
        const cloudStorage = window.Telegram?.WebApp?.CloudStorage
        if (!cloudStorage) return
        cloudStorage.setItem(key, currentValue)
    }, [key, currentValue])

    return (
        <PieCard
            card={'CloudStorageCard'}
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
                    const cloudStorage = window.Telegram?.WebApp?.CloudStorage
                    if (cloudStorage) cloudStorage.removeItem(key)
                    setCurrentValue('')
                },
            }}
        >
            <input type="hidden" id={name} name={name} value={currentValue} />
        </PieCard>
    )
}

export default CloudStorageCard
