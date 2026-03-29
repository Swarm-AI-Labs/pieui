import { ReactNode, useContext, useEffect, useRef, useState } from 'react'
import UI from '../../../UI'
import { AjaxGroupCardProps } from '../types'
import { UIConfigType, UIEventType } from '../../../../types'
import PieCard from '../../../PieCard'
import MittContext from '../../../../util/mitt'
import FallbackContext from '../../../../util/fallback'

const AjaxGroupCard = ({ data, content }: AjaxGroupCardProps) => {
    const {
        useLoader,
        noReturn,
        returnType,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const Fallback: ReactNode = useContext(FallbackContext)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [uiAjaxConfiguration, setUiAjaxConfiguration] =
        useState<UIConfigType | null>(null)
    const lastValidUiConfigRef = useRef<UIConfigType>(content)
    const mitt = useContext(MittContext)

    const setUiAjaxConfigurationForContentWrapper = (
        content: UIConfigType | null
    ) => {
        if (content === null) {
            setIsLoading(true)
        } else {
            setIsLoading(false)
            if (!noReturn) {
                lastValidUiConfigRef.current = content
            }
        }
        if (!noReturn) {
            setUiAjaxConfiguration(content)
        }
    }

    const onChangeContent = (event: any) => {
        lastValidUiConfigRef.current = event.content
        setUiAjaxConfiguration(event.content)
    }

    const setUiAjaxConfigurationForEventsWrapper = (
        events: Array<UIEventType> | null
    ) => {
        if (events === null) {
            setIsLoading(true)
        } else {
            setIsLoading(false)
            if (!noReturn) {
                for (const ev of events) {
                    mitt?.emit(ev.name, ev.data)
                }
            }
        }
    }

    useEffect(() => {
        setUiAjaxConfiguration(content)
        setIsLoading(false)
    }, [content])

    if (!uiAjaxConfiguration && useLoader) {
        return Fallback
    }

    return (
        <PieCard
            card={'AjaxGroupCard'}
            data={data}
            methods={{
                changeContent: onChangeContent,
            }}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
        >
            <UI
                uiConfig={uiAjaxConfiguration ?? lastValidUiConfigRef.current}
                setUiAjaxConfiguration={
                    returnType === 'events'
                        ? setUiAjaxConfigurationForEventsWrapper
                        : setUiAjaxConfigurationForContentWrapper
                }
            />
        </PieCard>
    )
}

export default AjaxGroupCard
