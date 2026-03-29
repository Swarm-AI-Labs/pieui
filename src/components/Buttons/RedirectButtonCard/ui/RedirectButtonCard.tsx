import { RedirectButtonCardProps } from '../types'
import PieCard from '../../../PieCard'
import parse from 'html-react-parser'
import { MouseEventHandler, useContext } from 'react'
import NavigateContext from '../../../../util/navigate.ts'

const RedirectButtonCard = ({ data }: RedirectButtonCardProps) => {
    const { name, title, url, iconUrl, iconPosition, sx } = data
    const navigate = useContext(NavigateContext)

    const routeChange: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (url) {
            event.stopPropagation()
            const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
            if (isExternal) {
                window.location.href = url
            } else {
                navigate?.(url)
            }
        }
    }

    return (
        <PieCard card={'RedirectButtonCard'} data={data}>
            <button
                id={name}
                className="box-border flex min-h-12 w-full min-w-min cursor-pointer items-center justify-center gap-4 rounded-l border border-black bg-white text-center text-black hover:bg-neutral-300"
                value={name}
                onClick={routeChange}
                style={sx}
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

export default RedirectButtonCard
