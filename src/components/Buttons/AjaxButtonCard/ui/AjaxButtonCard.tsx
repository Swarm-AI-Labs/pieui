import { AjaxButtonCardProps } from '../types'
import { PieCard } from '../../../PieCard'
import { useAjaxSubmit } from '../../../../util/ajaxCommonUtils'
import parse from 'html-react-parser'
import Radium from 'radium'
import { sx2radium } from '../../../../util/sx2radium.ts'

const AjaxButtonCard = Radium(
    ({ data, setUiAjaxConfiguration }: AjaxButtonCardProps) => {
        const {
            name,
            title,
            iconUrl,
            iconPosition,
            sx,
            pathname,
            kwargs,
            depsNames,
        } = data
        const ajaxSubmit = useAjaxSubmit(
            setUiAjaxConfiguration,
            kwargs,
            depsNames,
            pathname
        )

        return (
            <PieCard card={'AjaxButtonCard'} data={data}>
                <button
                    id={name}
                    className="box-border flex min-h-12 w-full min-w-min cursor-pointer items-center justify-center gap-4 rounded-l border border-black bg-white text-center text-black hover:bg-neutral-300"
                    value={name}
                    onClick={() => ajaxSubmit()}
                    style={sx2radium(sx)}
                    type="button"
                >
                    {iconUrl && iconPosition === 'start' && (
                        <img src={iconUrl} alt="" />
                    )}
                    {parse(title)}
                    {iconUrl && iconPosition === 'end' && (
                        <img src={iconUrl} alt="" />
                    )}
                </button>
            </PieCard>
        )
    }
)

export { AjaxButtonCard }
