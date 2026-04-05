'use client'

import '../types'
import { SetUiAjaxConfigurationType, UIEventType } from '../types'
import waitForSidAvailable from './waitForSidAvailable'
import { usePieConfig } from './pieConfig.ts'
import { useMemo } from 'react'

/** Options to avoid calling hooks inside useMemo. Pass from component via usePieConfig(). */
export type GetAjaxSubmitOptions = {
    apiServer?: string | null
    renderingLogEnabled?: boolean
}

export const getAjaxSubmit = (
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType,
    kwargs: Record<string, any> = {},
    depsNames: Array<string> = [],
    pathname?: string,
    options?: GetAjaxSubmitOptions
) => {
    const renderingLogEnabled = options?.renderingLogEnabled ?? false

    if (!options?.apiServer) {
        if (renderingLogEnabled) {
            console.warn('Registration FAILED: apiServer is missing!')
        }
        return () => {}
    }
    const apiServer = options?.apiServer

    if (renderingLogEnabled) {
        console.log('Registering AJAX: ', pathname, kwargs, depsNames)
    }

    if (!pathname || !setUiAjaxConfiguration) {
        if (renderingLogEnabled) {
            console.warn(
                'Registration FAILED: pathname or setUiAjaxConfiguration is missing!'
            )
        }
        return () => {}
    }

    return async (extraKwargs: Record<string, any> = {}) => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            if (renderingLogEnabled) {
                console.warn(
                    'getAjaxSubmit called on server, skipping DOM-dependent logic'
                )
            }
            return
        }

        if (depsNames.includes('sid')) {
            await waitForSidAvailable()
        }

        const data = new FormData()
        for (const [key, value] of Object.entries({
            ...kwargs,
            ...extraKwargs,
        })) {
            data.append(key, value)
        }

        for (const depName of depsNames) {
            if (depName === 'sid') {
                if (!window.sid)
                    throw new Error("SocketIO isn't initialized properly")
                data.append('sid', window.sid)
            } else {
                const inputs = document.getElementsByName(depName)
                if (!inputs.length) {
                    if (renderingLogEnabled) {
                        console.warn(`No input found with name ${depName}`)
                    }
                    continue
                }
                const input = inputs[0]
                if (input instanceof HTMLInputElement) {
                    if (input.type === 'file' && input.files) {
                        Array.from(input.files).forEach((file) =>
                            data.append(depName, file)
                        )
                    } else {
                        data.append(depName, input.value)
                    }
                } else if (input instanceof HTMLTextAreaElement) {
                    data.append(depName, input.value)
                }
            }
        }

        const apiEndpoint = apiServer + 'api/ajax_content' + pathname

        setUiAjaxConfiguration(null)
        return await fetch(apiEndpoint, {
            method: 'POST',
            body: data,
        })
            .then(async (response) => {
                const contentType = response.headers.get('content-type') || ''
                const isJson = contentType.includes('application/json')
                const isStream = !!response.body?.getReader && !isJson

                if (isStream) {
                    const reader = response.body!.getReader()
                    const decoder = new TextDecoder()
                    let buffer = ''

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        buffer += decoder.decode(value, { stream: true })

                        const lines = buffer.split('\n')
                        buffer = lines.pop() ?? ''

                        for (const line of lines) {
                            const trimmed = line.trim()
                            if (!trimmed) continue
                            try {
                                const currentEvent = JSON.parse(
                                    trimmed
                                ) as UIEventType
                                ;(
                                    setUiAjaxConfiguration as (
                                        events: UIEventType[]
                                    ) => void
                                )([currentEvent])
                            } catch {
                                if (renderingLogEnabled) {
                                    console.warn(
                                        'Failed to parse streamed line:',
                                        trimmed
                                    )
                                }
                            }
                        }
                    }

                    if (buffer.trim()) {
                        try {
                            const currentEvent = JSON.parse(
                                buffer
                            ) as UIEventType
                            ;(
                                setUiAjaxConfiguration as (
                                    events: UIEventType[]
                                ) => void
                            )([currentEvent])
                        } catch {
                            if (renderingLogEnabled) {
                                console.warn(
                                    'Failed to parse final streamed line:',
                                    buffer
                                )
                            }
                        }
                    }
                    return {}
                } else {
                    const data = await response.json()
                    setUiAjaxConfiguration(data)
                    return data
                }
            })
            .catch((err) => {
                if (renderingLogEnabled) {
                    console.error('AJAX request failed:', err)
                }
                setUiAjaxConfiguration(null)
                return err
            })
    }
}

export const useAjaxSubmit = (
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType,
    kwargs: Record<string, any> = {},
    depsNames: Array<string> = [],
    pathname?: string
) => {
    const { apiServer, enableRenderingLog } = usePieConfig()
    // kwargs/depsNames чаще всего приходят как инлайн-литералы из серверного
    // UIConfig — ссылка меняется на каждом рендере, поэтому ключом мемоизации
    // должно быть значение, а не ссылка.
    const kwargsKey = JSON.stringify(kwargs)
    const depsKey = JSON.stringify(depsNames)
    return useMemo(
        () =>
            getAjaxSubmit(setUiAjaxConfiguration, kwargs, depsNames, pathname, {
                apiServer,
                renderingLogEnabled: enableRenderingLog,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            setUiAjaxConfiguration,
            kwargsKey,
            depsKey,
            pathname,
            apiServer,
            enableRenderingLog,
        ]
    )
}
