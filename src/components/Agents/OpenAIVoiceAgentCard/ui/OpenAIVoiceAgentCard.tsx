import PieCard from '../../../PieCard'
import { OpenAIVoiceAgentCardProps } from '../types'
import type { RealtimeItem } from '@openai/agents/realtime'
import { useEffect, useState, useMemo, useRef } from 'react'
import {
    tool,
    RealtimeAgent,
    RealtimeSession,
    OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime'
import { getAjaxSubmit } from '../../../../util/ajaxCommonUtils'
import { UIConfigType, UIEventType } from '../../../../types'
import { z } from 'zod'
import { convertJsonSchemaToZod } from 'zod-from-json-schema'
import parse from 'html-react-parser'
import { usePieConfig } from '../../../../util/pieConfig.ts'

const OpenAIVoiceAgentCard = ({
    data,
    setUiAjaxConfiguration,
}: OpenAIVoiceAgentCardProps) => {
    const {
        name,
        titles,
        instructions,
        tools,
        token,
        autoStart,
        muted,
        language,
        outputModalities,
        sxMap,
        iconUrl,
        iconPosition,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data

    const { apiServer, enableRenderingLog } = usePieConfig()
    const [agent, setAgent] = useState<RealtimeAgent | null>(null)
    const [session, setSession] = useState<RealtimeSession | null>(null)
    const [transport, setTransport] = useState<OpenAIRealtimeWebRTC | null>(
        null
    )
    const [isConnected, setIsConnected] = useState(false)
    const [conversation, setConversation] = useState<Array<RealtimeItem>>([])
    const [, setError] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const agentTools = useMemo(() => {
        return tools.map((t) => {
            const ajaxTool = getAjaxSubmit(
                setUiAjaxConfiguration ?? (() => {}),
                t.kwargs,
                t.depsNames,
                t.pathname,
                {
                    apiServer,
                    renderingLogEnabled: enableRenderingLog,
                }
            )
            return tool({
                name: t.name,
                description: t.description,
                parameters: convertJsonSchemaToZod(
                    t.params
                ) as z.ZodObject<any>,
                // parameters: z.object({ city: z.string() }),
                async execute(data: any) {
                    console.log(
                        `Calling tool: ${t.name} with: ${JSON.stringify(data)}`
                    )
                    // return ajaxTool(data)
                    const result: Array<UIEventType> | UIConfigType =
                        await ajaxTool(data)

                    if (!Array.isArray(result)) {
                        return []
                    }
                    return result
                        .filter((ev) => ev.name === `pietoolOutput_${name}`)
                        .map((ev) => ev.data.output)
                },
            })
        })
    }, [tools, setUiAjaxConfiguration])

    // Disconnect session helper
    const disconnectSession = () => {
        console.log('Disconnecting session...')
        if (session) {
            session.close()
        }
        setSession(null)
        setAgent(null)
        setIsConnected(false)
    }

    // Connect to session
    const connectToSession = async (apiKey: string) => {
        if (!session) {
            console.error('Session not initialized')
            return
        }

        if (isConnected) {
            console.log('Already connected, skipping...')
            return
        }

        try {
            session.on('history_updated', (history) => {
                setConversation(history)
            })

            // if (muted) {
            //     session.on('audio_start', (event) => {
            //         session.mute(false)
            //         console.log('audio_start', event, session.muted)
            //     });
            //     session.on('audio_end', (event: any) => {
            //         session.mute(true)
            //         console.log('audio_end', event, session.muted)
            //     });
            //
            //     session.on('audio_interrupted', (event: any) => {
            //         session.mute(true)
            //         console.log('audio_interrupted', event, session.muted)
            //     });
            // }

            console.log('Connecting to session...')
            setError(null)
            await session.connect({ apiKey })

            // session.mute(!muted)
            setIsConnected(true)
            console.log('Connected successfully')
        } catch (err) {
            console.error('Failed to connect to session:', err)
            setError(err instanceof Error ? err.message : 'Failed to connect')
            setIsConnected(false)
        }
    }

    useEffect(() => {
        if (!audioRef.current) {
            return
        }
        if (!transport) {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then(async (mediaStream) => {
                    setTransport(
                        new OpenAIRealtimeWebRTC({
                            mediaStream: mediaStream,
                            audioElement: audioRef.current!,
                        })
                    )
                })
        }
    }, [audioRef])

    useEffect(() => {
        if (!audioRef.current) {
            return
        }
        if (!transport) {
            return
        }
        if (agent === null || session === null) {
            const newAgent = new RealtimeAgent({
                name: name,
                instructions: instructions,
                tools: agentTools,
            })

            const newSession = new RealtimeSession(newAgent, {
                model: 'gpt-realtime',
                transport: transport,
                // transport: "webrtc",
                config: {
                    outputModalities: outputModalities,
                    audio: {
                        input: {
                            transcription: {
                                language: language ?? undefined,
                                model: 'gpt-4o-mini-transcribe',
                            },
                            // turnDetection: {
                            //     type: 'semantic_vad',
                            //     eagerness: 'high',
                            //     idleTimeoutMs: 1000
                            // }
                        },
                    },
                    inputAudioTranscription: {
                        language: language ?? undefined,
                        model: 'gpt-4o-mini-transcribe',
                    },
                    // turnDetection: {
                    //     type: 'semantic_vad',
                    //     eagerness: 'high',
                    //     idleTimeoutMs: 1000
                    // }
                },
            })

            setAgent(newAgent)
            setSession(newSession)
        }
    }, [agent, session, name, instructions, agentTools, audioRef, transport])

    useEffect(() => {
        if (
            agent !== null &&
            session !== null &&
            autoStart &&
            token &&
            !isConnected
        ) {
            console.log('Auto-connecting...')
            connectToSession(token).catch((err) => {
                console.error('Auto-connection failed:', err)
            })
        }
    }, [agent, session])

    useEffect(() => {
        return () => {
            console.log('Disconnecting...')
            disconnectSession()
        }
    }, [])

    const onInitializeAIEvent = async (event: any) => {
        if (agent !== null && session !== null && event.token && !isConnected) {
            console.log('Connecting via initialize event...')
            await connectToSession(event.token).catch((err) => {
                console.error('Auto-connection failed:', err)
            })
        }
    }

    const onStopEvent = () => {
        disconnectSession()
    }

    return (
        <PieCard
            card="VoiceAgentCard"
            data={data}
            methods={{
                initializeAI: onInitializeAIEvent,
                stop: onStopEvent,
            }}
            useCentrifugeSupport={useCentrifugeSupport}
            useSocketioSupport={useSocketioSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
        >
            <button
                id={name}
                // className='box-border flex min-h-12 w-full min-w-min cursor-pointer items-center justify-center rounded-[16px] border border-[#080318] bg-white text-center font-[TTForsTrial] text-[#080318] hover:bg-neutral-300'
                value={name}
                onClick={async () => {
                    if (isConnected) {
                        disconnectSession()
                    } else {
                        if (token) {
                            await connectToSession(token)
                        }
                    }
                }}
                style={(
                    isConnected ? sxMap['enabled'] : sxMap['disabled']
                )}
                type="button"
            >
                {iconUrl && iconPosition === 'start' && (
                    <img src={iconUrl} alt="" />
                )}
                {parse(isConnected ? titles['enabled'] : titles['disabled'])}
                {iconUrl && iconPosition === 'end' && (
                    <img src={iconUrl} alt="" />
                )}
            </button>
            <input
                type="hidden"
                name={name}
                value={JSON.stringify(conversation)}
            />
            <audio
                ref={audioRef}
                autoPlay
                muted={muted}
                style={{ display: 'none' }}
            />
        </PieCard>
    )
}

export default OpenAIVoiceAgentCard
