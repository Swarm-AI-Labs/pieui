import parse from 'html-react-parser'
import { useState, useEffect, useContext } from 'react'
import MarkdownRender from './Markdown'
import UI from '../../../../UI'
import UIRendererContext from '../../../../../util/uiRenderer'
import MessageAvatar from './MessageAvatar'
import ChatOption from './ChatOption'
import { Message } from '../../types'
import { SetUiAjaxConfigurationType } from '../../../../../types'

const MessageCard = ({
    message,
    handleOptionClick,
    setUiAjaxConfiguration,
}: {
    message: Message
    handleOptionClick: (option: string) => void
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const Renderer = useContext(UIRendererContext) ?? UI
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (copied) setCopied(false)
        }, 1000)

        return () => clearTimeout(timeout)
    }, [copied])

    return (
        <div className="group w-full border-b border-black/10" id={message.id}>
            <div
                className={`flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-3xl xl:max-w-5xl ${message.align === 'center' ? 'm-auto' : ''} ${message.align === 'right' ? 'ml-auto justify-end' : ''} ${message.align === 'left' ? 'mr-auto' : ''} `}
            >
                {(message.align === 'left' || message.align === 'center') && (
                    <div className="relative flex shrink-0 flex-col items-end">
                        <MessageAvatar
                            username={message.username}
                            avatar={message.avatar}
                        />
                    </div>
                )}
                <div className="relative flex w-[calc(100%-50px)] flex-col gap-1 md:gap-3 lg:w-[calc(100%-115px)]">
                    <div
                        className={`markdown light prose w-full break-words dark:prose-invert first:mt-0 ${message.align === 'right' ? 'flex justify-end self-end' : ''}`}
                    >
                        {typeof message.content === 'string' ? (
                            message.parseMode.toLowerCase() === 'markdown' ? (
                                <MarkdownRender
                                    key={Date.now() + Math.random()}
                                >
                                    {message.content}
                                </MarkdownRender>
                            ) : message.parseMode.toLowerCase() === 'html' ? (
                                parse(message.content)
                            ) : (
                                message.content
                            )
                        ) : (
                            <Renderer
                                uiConfig={message.content}
                                setUiAjaxConfiguration={setUiAjaxConfiguration}
                            />
                        )}
                    </div>
                    <div className="flex flex-row flex-wrap justify-start gap-1">
                        {message.options.map((option, idx) => (
                            <ChatOption
                                key={idx}
                                onClickOption={handleOptionClick}
                                option={option}
                            />
                        ))}
                    </div>
                </div>
                {message.align === 'right' && (
                    <div className="relative flex shrink-0 flex-col items-end">
                        <MessageAvatar
                            username={message.username}
                            avatar={message.avatar}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default MessageCard
