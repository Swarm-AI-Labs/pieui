import { useEffect, useState } from 'react'
import { SecureStorageCardProps } from '../types'
import PieCard from '../../../PieCard'

const SecureStorageCard = ({ data }: SecureStorageCardProps) => {
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
        const secureStorage = window.Telegram?.WebApp?.SecureStorage
        if (!secureStorage) return
        secureStorage.setItem(key, currentValue)
    }, [key, currentValue])

    return (
        <PieCard
            card={'SecureStorageCard'}
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
                    const secureStorage = window.Telegram?.WebApp?.SecureStorage
                    if (secureStorage) secureStorage.removeItem(key)
                    setCurrentValue('')
                },
            }}
        >
            <input type="hidden" id={name} name={name} value={currentValue} />
        </PieCard>
    )
}

export default SecureStorageCard
