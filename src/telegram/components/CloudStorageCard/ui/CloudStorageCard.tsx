import { useEffect, useState } from 'react'
import { CloudStorageCardProps } from '../types'
import PieCard from '../../../../components/PieCard'

/**
 * Persists `data.value` to Telegram `WebApp.CloudStorage` under `data.key` and
 * mirrors it into a hidden input named `data.name`.
 *
 * Sending the value with an Ajax submit — two options:
 * - **Direct:** add `'telegram:cloud:<key>'` to the Ajax card's `depsNames`.
 *   `readAjaxKeyAsync` reads it straight from CloudStorage (async) and submits
 *   it under the bare `<key>`.
 * - **Via the hidden input:** add this card's `data.name` to `depsNames`; the
 *   value is read synchronously from the rendered hidden input by name.
 */
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
