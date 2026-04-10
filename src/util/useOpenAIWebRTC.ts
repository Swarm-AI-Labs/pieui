'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A single OpenAI Realtime event exchanged over the WebRTC data channel.
 * `type` is always present; `event_id` and `timestamp` are auto-populated
 * by the hook when missing. Any additional fields defined by the OpenAI
 * Realtime API are passed through unchanged.
 */
export type OpenAIEvent = {
    type: string
    event_id?: string
    timestamp?: string
    [key: string]: any
}

/**
 * Return type of {@link useOpenAIWebRTC}. Exposes the live session state
 * and imperative controls for opening/closing a realtime voice session.
 *
 * @property isSessionActive Whether the peer connection is currently
 *                           `connected` — updates in real time.
 * @property startSession    Opens a new peer connection to the OpenAI
 *                           Realtime API and attaches the configured audio
 *                           element. Resolves once the data channel is
 *                           open and safe to send on.
 * @property stopSession     Stops microphone tracks, closes the peer
 *                           connection, and releases all resources.
 * @property sendTextMessage Queues a `conversation.item.create` + `response.create`
 *                           pair on the data channel, waiting for the
 *                           channel to open if necessary.
 */
export type UseOpenAIWebRTCReturn = {
    isSessionActive: boolean
    startSession: (
        ephemeralKey: string,
        useMicrophone?: boolean
    ) => Promise<void>
    stopSession: () => void
    sendTextMessage: (text: string) => void
}

// Создаём немой аудио-трек для случаев без микрофона
function createSilentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const dst = oscillator.connect(ctx.createMediaStreamDestination())
    oscillator.start()

    const track = (dst as any).stream.getAudioTracks()[0]
    track.enabled = false
    return track
}

/**
 * React hook that manages a realtime voice session with the OpenAI Realtime
 * API over WebRTC.
 *
 * Usage flow:
 * 1. Render an `<audio autoPlay />` element and pass its ref in as
 *    `audioElement` — remote audio will be routed there.
 * 2. Fetch an ephemeral key from your backend.
 * 3. Call `startSession(ephemeralKey, useMicrophone?)`. When `useMicrophone`
 *    is `false` the hook creates a silent local track so the peer connection
 *    is still valid (useful for text-only demos).
 * 4. Use `sendTextMessage(text)` to inject user turns and receive replies
 *    via the `onEvent` callback.
 * 5. Call `stopSession()` when done.
 *
 * All handlers are stable and safe to pass to dependent effects/memos.
 *
 * @param audioElement Target `<audio>` element used to play back the model's
 *                     response audio. `null` disables playback routing.
 * @param onEvent      Optional listener invoked for every incoming and
 *                     outgoing realtime event (with `timestamp` populated).
 */
export default function useOpenAIWebRTC(
    audioElement: HTMLAudioElement | null = null,
    onEvent?: (event: OpenAIEvent) => void
): UseOpenAIWebRTCReturn {
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const dataChannelRef = useRef<RTCDataChannel | null>(null)
    const waitForDataChannelOpen = useRef<Promise<void> | null>(null)

    const startSession = useCallback(
        async (ephemeralKey: string, useMicrophone: boolean = true) => {
            if (peerConnection.current) stopSession()

            const pc = new RTCPeerConnection()

            // Обновляем isSessionActive по реальному состоянию соединения
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') {
                    setIsSessionActive(true)
                } else if (
                    ['disconnected', 'failed', 'closed'].includes(
                        pc.connectionState
                    )
                ) {
                    setIsSessionActive(false)
                }
            }

            pc.ontrack = (e: RTCTrackEvent) => {
                if (audioElement) audioElement.srcObject = e.streams[0]
            }

            if (useMicrophone) {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                })
                pc.addTrack(mediaStream.getTracks()[0], mediaStream)
            } else {
                const silentTrack = createSilentAudioTrack()
                pc.addTrack(silentTrack)
            }

            const dc = pc.createDataChannel('oai-events')
            dataChannelRef.current = dc

            // Promise ждёт открытия DataChannel
            waitForDataChannelOpen.current = new Promise<void>((resolve) => {
                dc.addEventListener('open', () => {
                    resolve()
                })
            })

            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            const baseUrl = 'https://api.openai.com/v1/realtime/calls'
            const model = 'gpt-realtime'
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    'Content-Type': 'application/sdp',
                },
            })

            const sdp = await sdpResponse.text()
            await pc.setRemoteDescription({ type: 'answer', sdp })

            peerConnection.current = pc

            // ждём открытия DataChannel, чтобы можно было безопасно отправлять сообщения
            await waitForDataChannelOpen.current
        },
        [audioElement]
    )

    const stopSession = useCallback(() => {
        const dc = dataChannelRef.current
        if (dc) dc.close()

        peerConnection.current
            ?.getSenders()
            ?.forEach((sender) => sender.track?.stop())
        peerConnection.current?.close()

        setIsSessionActive(false)
        peerConnection.current = null
        dataChannelRef.current = null
        waitForDataChannelOpen.current = null
    }, [audioElement])

    const sendClientEvent = useCallback(
        (message: OpenAIEvent) => {
            const dc = dataChannelRef.current
            if (!dc) {
                console.error('Data channel is not ready', message)
                return
            }

            const timestamp = new Date().toLocaleTimeString()
            message.event_id = message.event_id || crypto.randomUUID()

            dc.send(JSON.stringify(message))

            if (!message.timestamp) message.timestamp = timestamp
            onEvent?.(message)
        },
        [onEvent, audioElement]
    )

    const sendTextMessage = useCallback(
        (text: string) => {
            const dc = dataChannelRef.current
            if (!dc) {
                console.error('Data channel is not ready')
                return
            }

            const send = () => {
                const event: OpenAIEvent = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text }],
                    },
                }
                sendClientEvent(event)
                sendClientEvent({ type: 'response.create' })
            }

            // Ждём открытия канала, если ещё не открылся
            if (waitForDataChannelOpen.current) {
                waitForDataChannelOpen.current.then(send)
            } else {
                send()
            }
        },
        [onEvent, audioElement]
    )

    useEffect(() => {
        const dc = dataChannelRef.current
        if (!dc) return

        const handleMessage = (e: MessageEvent) => {
            const event: OpenAIEvent = JSON.parse(e.data)
            if (!event.timestamp)
                event.timestamp = new Date().toLocaleTimeString()
            onEvent?.(event)
        }

        dc.addEventListener('message', handleMessage)
        return () => {
            dc.removeEventListener('message', handleMessage)
        }
    }, [onEvent, audioElement])

    return {
        isSessionActive,
        startSession,
        stopSession,
        sendTextMessage,
    }
}
