import { useEffect, useState } from 'react'
import { DeviceStorageCardProps } from '../types'
import PieCard from '../../../PieCard'

/**
 * Persists `data.value` to `localStorage` under `data.key` and mirrors it into
 * a hidden input named `data.name` so the value participates in form / Ajax
 * submissions.
 *
 * Sending the value with an Ajax submit — two options:
 * - **Direct (preferred):** add `'localStorage:<key>'` to the Ajax card's
 *   `depsNames`. `readAjaxKey` reads `localStorage.getItem(key)` straight from
 *   storage and submits it under the bare `<key>`. No `name` wiring needed.
 * - **Via the hidden input:** add this card's `data.name` to `depsNames`; the
 *   value is read from the rendered hidden input by name (the original path).
 *
 * The hidden input is still rendered for the second option and for plain
 * (non-Ajax) form submission via the global form.
 */
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
