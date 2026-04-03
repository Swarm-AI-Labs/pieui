import { useContext } from 'react'
import { UIConfigType } from '../../../../types'
import { SequenceCardProps } from '../types'
import PieCard from '../../../PieCard'
import UI from '../../../UI'
import UIRendererContext from '../../../../util/uiRenderer'

const SequenceCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: SequenceCardProps) => {
    const { name, sx } = data
    const Renderer = useContext(UIRendererContext) ?? UI
    return (
        <PieCard card={name} data={data}>
            <div style={sx} id={name}>
                {content.map((obj: UIConfigType, i: number) => {
                    return (
                        <Renderer
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
