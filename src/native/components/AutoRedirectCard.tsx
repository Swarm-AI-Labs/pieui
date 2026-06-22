import { ReactNode, useContext, useEffect } from 'react'
import { Linking } from 'react-native'
import NavigateContext from '../../util/navigate'
import FallbackContext from '../../util/fallback'

/**
 * React Native variant of `AutoRedirectCard`. On mount routes to `data.url` via
 * `Linking` (external) or `NavigateContext` (internal), rendering the fallback
 * in the meantime.
 */
const AutoRedirectCard = ({ data }: { data: any }) => {
    const { url } = data
    const navigate = useContext(NavigateContext)
    const Fallback: ReactNode = useContext(FallbackContext)

    useEffect(() => {
        const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
        if (isExternal) Linking.openURL(url).catch(() => {})
        else navigate?.(url)
    }, [url, navigate])

    return <>{Fallback}</>
}

export default AutoRedirectCard
