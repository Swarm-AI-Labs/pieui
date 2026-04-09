import { AutoRedirectCardProps } from '../types'
import { ReactNode, useContext, useEffect } from 'react'
import NavigateContext from '../../../../util/navigate.ts'
import FallbackContext from '../../../../util/fallback.tsx'

const AutoRedirectCard = ({ data }: AutoRedirectCardProps) => {
    const { url } = data
    const navigate = useContext(NavigateContext)
    const Fallback: ReactNode = useContext(FallbackContext)

    useEffect(() => {
        const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
        if (isExternal) {
            window.location.href = url
        } else {
            navigate?.(url)
        }
    }, [url, navigate])

    return <>{Fallback}</>
}

export default AutoRedirectCard
