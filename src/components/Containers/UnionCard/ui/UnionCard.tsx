import { useContext } from 'react'
import { UIConfigType } from '../../../../types'
import { UnionCardProps } from '../types'
import PieCard from '../../../PieCard'
import UI from '../../../UI'
import UIRendererContext from '../../../../util/uiRenderer'

const UnionCard = ({
    data,
    content,
    setUiAjaxConfiguration,
}: UnionCardProps) => {
    const { name } = data
    const Renderer = useContext(UIRendererContext) ?? UI
    return (
        <PieCard card={name} data={data}>
            {content.map((obj: UIConfigType, i: number) => {
                return (
                    <Renderer
                        key={`children-${i}`}
                        uiConfig={obj}
                        setUiAjaxConfiguration={setUiAjaxConfiguration}
                    />
                )
            })}
        </PieCard>
    )
}

export default UnionCard
