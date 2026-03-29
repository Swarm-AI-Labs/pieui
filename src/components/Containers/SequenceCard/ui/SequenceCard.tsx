import { UIConfigType } from '../../../../types'
import { SequenceCardProps } from '../types'
import PieCard from '../../../PieCard'
import UI from '../../../UI'

const SequenceCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: SequenceCardProps) => {
    const { name, sx } = data
    return (
        <PieCard card={name} data={data}>
            <div style={sx} id={name}>
                {content.map((obj: UIConfigType, i: number) => {
                    return (
                        <UI
                            key={`children-${i}`}
                            uiConfig={obj}
                            setUiAjaxConfiguration={setUiAjaxConfiguration}
                        />
                    )
                })}
            </div>
        </PieCard>
    )
}

export default SequenceCard
