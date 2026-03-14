import { AutoRedirectCardProps } from '../types'
import { useContext, useEffect } from 'react'
import NavigateContext from '../../../../util/navigate.ts'

const AutoRedirectCard = ({ data }: AutoRedirectCardProps) => {
    const { url } = data
    const navigate = useContext(NavigateContext)

    useEffect(() => {
        const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
        if (isExternal) {
            window.location.href = url
        } else {
            navigate?.(url)
        }
    }, [url, navigate])

    return <></>
}

export { AutoRedirectCard }
