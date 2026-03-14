import { UIConfigType } from '../../../../types'
import { SequenceCardProps } from '../types'
import { PieCard } from '../../../PieCard'
import { UI } from '../../../UI'
import Radium from 'radium'
import { sx2radium } from '../../../../util/sx2radium.ts'

const SequenceCard = Radium(
    ({ data, content, setUiAjaxConfiguration }: SequenceCardProps) => {
        const { name, sx } = data
        return (
            <PieCard card={name} data={data}>
                <div style={sx2radium(sx)} id={name}>
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
)

export { SequenceCard }
