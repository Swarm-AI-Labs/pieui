import { useEffect, useState } from 'react'
import { HiddenCardProps } from '../types'
import { PieCard } from '../../../PieCard'

const HiddenCard = ({ data }: HiddenCardProps) => {
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
        >
            <input type="hidden" id={name} name={name} value={currentValue} />
        </PieCard>
    )
}

export { HiddenCard }
