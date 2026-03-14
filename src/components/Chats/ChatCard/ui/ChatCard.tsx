import { useAjaxSubmit } from '../../../../util/ajaxCommonUtils'
import { ChatCardProps } from '../types'
import { PieCard } from '../../../PieCard'
import ChatCardInput, { ChatCardInputHandle } from './components/ChatCardInput'
import MessagesBoard, { MessagesBoardHandle } from './components/MessagesBoard'
import { useEffect, useMemo, useRef, useState } from 'react'

const ChatCard = ({ data, setUiAjaxConfiguration }: ChatCardProps) => {
    const {
        name,
        defaultValue,
        defaultMessages,
        defaultOptions,
        isArea,
        fileAccept,
        placeholder,
        icons,
        optionsPosition,
        sxMap = {
            container: {},
            chatInput: {},
            messages: {},
        },
        depsNames,
        pathname,
        kwargs,
        useSocketioSupport,
        useCentrifugeSupport,
        centrifugeChannel,
    } = data

    const inputRef = useRef<ChatCardInputHandle>(null)
    const messagesRef = useRef<MessagesBoardHandle>(null)
    const [dirty, setDirty] = useState<boolean>(false)
    const ajaxSubmit = useAjaxSubmit(
        setUiAjaxConfiguration,
        kwargs,
        depsNames,
        pathname
    )

    useEffect(() => {
        if (dirty) {
            requestAnimationFrame(() => {
                ajaxSubmit()
                setDirty(false)
            })
        }
    }, [dirty])

    const handleOptionClick = (option: string) => {
        if (inputRef.current) {
            inputRef.current.setValue(option)
            setDirty(true)
        }
    }

    const onClearInput = () => {
        if (inputRef.current) {
            inputRef.current.clear()
        }
    }

    const onSetOptions = (event: any) => {
        if (inputRef.current) {
            inputRef.current.setOptions(event.options)
        }
    }

    const onAddMessage = (event: any) => {
        if (messagesRef.current) {
            messagesRef.current.addMessage(event.message)
        }
    }

    const onSetMessages = (event: any) => {
        if (messagesRef.current) {
            messagesRef.current.setMessages(event.messages)
        }
    }

    const handleSendMessage = () => {
        setDirty(true)
    }

    return (
        <PieCard
            card="ChatCard"
            data={data}
            methods={{
                clearInput: onClearInput,
                setOptions: onSetOptions,
                addMessage: onAddMessage,
                setMessages: onSetMessages,
            }}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            centrifugeChannel={centrifugeChannel}
        >
            <div className="flex size-full flex-col" style={sxMap.container}>
                <MessagesBoard
                    ref={messagesRef}
                    name={name}
                    defaultMessages={defaultMessages}
                    sx={sxMap.messages}
                    handleOptionClick={handleOptionClick}
                    setUiAjaxConfiguration={setUiAjaxConfiguration}
                />
                <ChatCardInput
                    ref={inputRef}
                    name={name}
                    isArea={isArea}
                    defaultOptions={defaultOptions}
                    placeholder={placeholder}
                    defaultValue={defaultValue}
                    fileAccept={fileAccept}
                    sx={sxMap.chatInput}
                    handleSendMessage={handleSendMessage}
                    handleOptionClick={handleOptionClick}
                    optionsPosition={optionsPosition}
                    icons={icons}
                />
            </div>
        </PieCard>
    )
}

export { ChatCard }
