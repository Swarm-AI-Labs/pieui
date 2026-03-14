import {PieCard} from '../../../PieCard'
import { useEffect, useState } from 'react'
import parse from 'html-react-parser'
import { HTMLEmbedCardProps } from '../types'
import Radium from 'radium'
import {useOpenAIWebRTC} from '../../../../util/useOpenAIWebRTC'

const HTMLEmbedCard = Radium(({ data }: HTMLEmbedCardProps) => {
    const {
        html,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const [valueCurrent, setValueCurrent] = useState(html)

    const { isSessionActive, startSession, sendTextMessage } = useOpenAIWebRTC(
        null,
        (event) => {
            console.log(
                event.type,
                event.type === 'response.output_text.delta' && event.delta
            )
            if (event.type === 'response.output_text.delta' && event.delta) {
                setValueCurrent((prev) => prev + event.delta)
            }
        }
    )

    useEffect(() => {
        setValueCurrent(html)
    }, [html])

    const onUpdateEvent = (event: any) => {
        setValueCurrent(event.value)
    }

    const onInitializeAIEvent = async (event: any) => {
        if (!isSessionActive && event.token) {
            await startSession(event.token, false)
        }
    }

    const onGenerateUsingAIEvent = async (event: any) => {
        try {
            // Стартуем сессию без микрофона
            if (!isSessionActive && event.token) {
                await startSession(event.token, false)
            }

            // Отправляем текст в AI
            sendTextMessage(event.prompt)
        } catch (err) {
            console.error('Failed to generate using AI', err)
        }
    }

    return (
        <PieCard
            card="HTMLEmbedCard"
            data={data}
            methods={{
                update: onUpdateEvent,
                generateUsingAI: onGenerateUsingAIEvent,
                initializeAI: onInitializeAIEvent,
            }}
            useCentrifugeSupport={useCentrifugeSupport}
            useSocketioSupport={useSocketioSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
        >
            {parse(valueCurrent)}
        </PieCard>
    )
})

export { HTMLEmbedCard }
