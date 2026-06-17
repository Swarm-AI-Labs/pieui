import { useEffect, useState } from 'react'
import { SessionStorageCardProps } from '../types'
import PieCard from '../../../PieCard'

/**
 * Persists `data.value` to `sessionStorage` under `data.key` and mirrors it
 * into a hidden input named `data.name` so the value participates in form /
 * Ajax submissions.
 *
 * Sending the value with an Ajax submit — two options:
 * - **Direct (preferred):** add `'sessionStorage:<key>'` to the Ajax card's
 *   `depsNames`. `readAjaxKey` reads `sessionStorage.getItem(key)` straight from
 *   storage and submits it under the bare `<key>`. No `name` wiring needed.
 * - **Via the hidden input:** add this card's `data.name` to `depsNames`; the
 *   value is read from the rendered hidden input by name (the original path).
 *
 * The hidden input is still rendered for the second option and for plain
 * (non-Ajax) form submission via the global form.
 */
const SessionStorageCard = ({ data }: SessionStorageCardProps) => {
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
        sessionStorage.setItem(key, currentValue)
    }, [key, currentValue])

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
                    sessionStorage.removeItem(key)
                    setCurrentValue('')
                },
            }}
        >
            <input type="hidden" id={name} name={name} value={currentValue} />
        </PieCard>
    )
}

export default SessionStorageCard
