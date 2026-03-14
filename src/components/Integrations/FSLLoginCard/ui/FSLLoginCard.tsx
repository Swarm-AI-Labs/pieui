import {PieCard} from '../../../PieCard'
import { FSLLoginCardProps } from '../types'
import { MouseEventHandler } from 'react'

let fslModulePromise: Promise<any> | null = null

const loadFSL = () => {
    if (!fslModulePromise) {
        fslModulePromise = import('fsl-authorization')
            .then((mod) => mod.default ?? mod)
            .catch((err) => {
                fslModulePromise = null // чтобы можно было повторить после установки/фикса
                console.warn(
                    'fsl-authorization is not installed. Please install it to use FSLLoginCard.',
                    err
                )
                return null
            })
    }
    return fslModulePromise
}

const FSLLoginCard = ({ data }: FSLLoginCardProps) => {
    const {
        errorMessage,
        sx,
        title,
        iconUrl = 'https://id.fsl.com/assets/fslId.svg',
        iconPosition,
    } = data

    const handleClick: MouseEventHandler<HTMLButtonElement> = async (event) => {
        event.preventDefault()
        const FSLAuthorization = await loadFSL()
        if (!FSLAuthorization) {
            return
        }
        const fslAuthorization = await FSLAuthorization?.init({
            responseType: 'code', // 'code' or 'token'
            appKey: data.appKey,
            redirectUri: data.redirectUri, // https://xxx.xxx.com
            scope: 'basic,wallet', // Grant Scope
            state: data.state,
            isApp: data.isApp,
            usePopup: data.usePopup, // Popup a window instead of jump to
        })
        await fslAuthorization?.signIn()
    }

    return (
        <PieCard card={'FSLLoginCard'} data={data}>
            <button
                className={`flex w-full items-center justify-center gap-2 rounded-lg border border-[#01FFDA] bg-[rgb(41,41,41)] px-4 py-2 text-white`}
                style={sx}
                onClick={handleClick}
            >
                {iconUrl && iconPosition === 'start' && (
                    <img src={iconUrl} alt="fsl_icon" />
                )}
                {title}
                {iconUrl && iconPosition === 'end' && (
                    <img src={iconUrl} alt="fsl_icon" />
                )}
            </button>

            {errorMessage && (
                <div className="mt-1 text-sm font-light leading-normal text-[#FD7A71]">
                    {errorMessage}
                </div>
            )}
        </PieCard>
    )
}

export { FSLLoginCard }
