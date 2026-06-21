'use client'

import '../types'
import { SetUiAjaxConfigurationType, UIEventType } from '../types'
import waitForSidAvailable from './waitForSidAvailable'
import { usePieConfig } from './pieConfig.ts'
import { useMemo } from 'react'
import clientSources from '../platform/clientSources'

/**
 * Retry policy configuration for AJAX requests.
 */
export type RetryPolicy = {
    /** Maximum number of retry attempts (default: 0 — no retries). */
    maxRetries?: number
    /** Base delay in ms between retries (default: 1000). Doubled on each attempt. */
    baseDelay?: number
    /** HTTP status codes that should trigger a retry (default: [502, 503, 504]). Timeouts and network errors always retry regardless of this list. */
    retryOn?: number[]
}

/**
 * Options for {@link getAjaxSubmit}. Passed explicitly so that the helper can
 * stay a plain function — callers forward the values they already obtained
 * from {@link usePieConfig} instead of the helper calling hooks on its own.
 */
export type GetAjaxSubmitOptions = {
    /** Base URL of the PieUI API server (must end with `/`). */
    apiServer?: string | null
    /** When `true`, the helper will log registration and error details. */
    renderingLogEnabled?: boolean
    /** Request timeout in milliseconds. No timeout if omitted. */
    timeout?: number
    /** Retry policy for failed requests. No retries if omitted. */
    retryPolicy?: RetryPolicy
}

/**
 * The origin a dep value is read from. `dom` is the default for any name
 * without a recognized prefix.
 */
export type DepSource =
    | 'dom'
    | 'sid'
    | 'localStorage'
    | 'sessionStorage'
    | 'cookie'
    | 'url'
    | 'telegram:cloud'
    | 'telegram:secure'

const DEP_SOURCE_PREFIXES: Array<Exclude<DepSource, 'dom' | 'sid'>> = [
    'localStorage',
    'sessionStorage',
    'cookie',
    'url',
    'telegram:cloud',
    'telegram:secure',
]

/**
 * Sources whose values can only be read asynchronously (Telegram Cloud/Secure
 * storage expose callback-based `getItem`). These are resolved by
 * {@link readAjaxKeyAsync}; the synchronous {@link readAjaxKey} cannot serve
 * them and returns `[]`.
 */
const ASYNC_DEP_SOURCES = new Set<DepSource>(['telegram:cloud', 'telegram:secure'])

/**
 * Splits a dep name into its source and bare key, following the magic-name
 * convention used by Ajax cards.
 *
 * - `'sid'` → `{ source: 'sid', key: 'sid' }` (SocketIO session id).
 * - `'localStorage:token'` → `{ source: 'localStorage', key: 'token' }`; the
 *   same for `sessionStorage:`, `cookie:`, `url:`, `telegram:cloud:` and
 *   `telegram:secure:` prefixes.
 * - Anything else (including a name that contains a colon but no recognized
 *   prefix) → `{ source: 'dom', key: <name> }`.
 *
 * The returned `key` is what gets sent to the backend as the field name, so a
 * prefixed dep is submitted under its bare key (`localStorage:token` → `token`).
 */
export const parseDepName = (
    depName: string
): { source: DepSource; key: string } => {
    if (depName === 'sid') return { source: 'sid', key: 'sid' }

    for (const source of DEP_SOURCE_PREFIXES) {
        const prefix = source + ':'
        if (depName.startsWith(prefix)) {
            return { source, key: depName.slice(prefix.length) }
        }
    }

    return { source: 'dom', key: depName }
}

/**
 * Reads the value(s) for a single dep name, following the same convention used
 * by Ajax cards. Returns an array because file inputs (and cookies / repeated
 * URL params) can contribute multiple values for the same key.
 *
 * The source is determined by {@link parseDepName}:
 * - `'sid'` resolves to `window.sid`. The caller must ensure SocketIO is
 *   ready (e.g. via {@link waitForSidAvailable}) before calling this.
 * - `localStorage:` / `sessionStorage:` read `getItem(key)` (try/caught, since
 *   storage access can throw in private mode); missing/blocked → `[]`.
 * - `cookie:` reads and `decodeURIComponent`s the matching cookie; missing →
 *   `[]`.
 * - `url:` reads `URLSearchParams(location.search).getAll(key)` (repeated
 *   params supported); missing → `[]`.
 * - `telegram:cloud:` / `telegram:secure:` are asynchronous and cannot be
 *   served here — they return `[]`. Use {@link readAjaxKeyAsync} instead (the
 *   Ajax submit flow already does).
 * - DOM names are looked up via `document.getElementsByName`; only the first
 *   match is read. `<input type="file">` returns every selected `File`; other
 *   `<input>` / `<textarea>` returns the current `.value`.
 * - Missing values return `[]` (and emit a warning when `renderingLogEnabled`).
 *
 * Must run in a browser environment — relies on `document` and `window`.
 *
 * @throws if the resolved source is `sid` and `window.sid` is not initialized.
 */
export const readAjaxKey = (
    depName: string,
    renderingLogEnabled: boolean = false
): Array<string | File> => {
    const { source, key } = parseDepName(depName)

    if (source === 'sid') {
        const sid = clientSources.readSid()
        if (!sid) throw new Error("SocketIO isn't initialized properly")
        return [sid]
    }

    if (source === 'localStorage' || source === 'sessionStorage') {
        try {
            const value = clientSources.readWebStorage(
                source === 'localStorage' ? 'local' : 'session',
                key
            )
            if (value === null) {
                if (renderingLogEnabled) {
                    console.warn(`No ${source} value found for key ${key}`)
                }
                return []
            }
            return [value]
        } catch (err) {
            if (renderingLogEnabled) {
                console.warn(`Failed to read ${source} key ${key}:`, err)
            }
            return []
        }
    }

    if (source === 'cookie') {
        const value = clientSources.readCookie(key)
        if (value === null) {
            if (renderingLogEnabled) {
                console.warn(`No cookie found for key ${key}`)
            }
            return []
        }
        return [value]
    }

    if (source === 'url') {
        const values = clientSources.readUrlParams(key)
        if (!values.length && renderingLogEnabled) {
            console.warn(`No URL query param found for key ${key}`)
        }
        return values
    }

    if (ASYNC_DEP_SOURCES.has(source)) {
        if (renderingLogEnabled) {
            console.warn(
                `Source ${source} is async; use readAjaxKeyAsync (readAjaxKey returns [])`
            )
        }
        return []
    }

    const values = clientSources.readDomInput(key)
    if (values === null) {
        if (renderingLogEnabled) {
            console.warn(`No input found with name ${key}`)
        }
        return []
    }
    return values
}

/**
 * Reads a single value from Telegram `WebApp.CloudStorage` /
 * `WebApp.SecureStorage`. Both expose a callback-based `getItem`, so this is
 * inherently asynchronous. Resolves to `['<value>']` on success and `[]` when
 * the store is unavailable, the key is missing/empty, or the read errors.
 */
const readTelegramStorage = (
    source: 'telegram:cloud' | 'telegram:secure',
    key: string,
    renderingLogEnabled: boolean
): Promise<string[]> => {
    const webApp = window.Telegram?.WebApp
    const store =
        source === 'telegram:cloud'
            ? webApp?.CloudStorage
            : webApp?.SecureStorage
    const label =
        source === 'telegram:cloud'
            ? 'Telegram CloudStorage'
            : 'Telegram SecureStorage'

    if (!store) {
        if (renderingLogEnabled) console.warn(`${label} is not available`)
        return Promise.resolve([])
    }

    return new Promise((resolve) => {
        try {
            store.getItem(key, (error, value) => {
                if (error) {
                    if (renderingLogEnabled) {
                        console.warn(`Failed to read ${label} key ${key}:`, error)
                    }
                    resolve([])
                    return
                }
                if (value == null || value === '') {
                    if (renderingLogEnabled) {
                        console.warn(`No ${label} value found for key ${key}`)
                    }
                    resolve([])
                    return
                }
                resolve([value])
            })
        } catch (err) {
            if (renderingLogEnabled) {
                console.warn(`Failed to read ${label} key ${key}:`, err)
            }
            resolve([])
        }
    })
}

/**
 * Asynchronous counterpart to {@link readAjaxKey}. Behaves identically for all
 * synchronous sources (it delegates to `readAjaxKey`) but additionally resolves
 * the asynchronous Telegram sources (`telegram:cloud:` / `telegram:secure:`).
 *
 * This is what the Ajax submit flow uses so that every supported source — sync
 * or async — can contribute values to the request.
 */
export const readAjaxKeyAsync = async (
    depName: string,
    renderingLogEnabled: boolean = false
): Promise<Array<string | File>> => {
    const { source, key } = parseDepName(depName)
    if (source === 'telegram:cloud' || source === 'telegram:secure') {
        return readTelegramStorage(source, key, renderingLogEnabled)
    }
    return readAjaxKey(depName, renderingLogEnabled)
}

/**
 * Builds an async "submit" function that issues an AJAX request to
 * `api/ajax_content{pathname}` and streams (or JSON-decodes) the response
 * into a `setUiAjaxConfiguration` callback supplied by an Ajax container.
 *
 * The returned function collects form data from:
 * 1. the static `kwargs` object,
 * 2. any `extraKwargs` passed at call time,
 * 3. the dep names in `depsNames`, each resolved by {@link readAjaxKeyAsync}
 *    from its source: DOM inputs by default, `sid` (resolved via
 *    {@link waitForSidAvailable}), or the `localStorage:`, `sessionStorage:`,
 *    `cookie:`, `url:`, `telegram:cloud:` and `telegram:secure:` prefixes —
 *    submitted under the bare key, and
 * 4. file inputs (multiple files supported).
 *
 * If the server streams NDJSON, each line is parsed as a `UIEventType` and
 * applied incrementally; otherwise the full JSON body replaces the current
 * Ajax configuration.
 *
 * On missing `apiServer`, `pathname` or `setUiAjaxConfiguration` the helper
 * returns a no-op function so call sites do not need to null-check.
 *
 * @param setUiAjaxConfiguration Setter provided by the enclosing Ajax card.
 * @param kwargs                 Static key/value pairs appended to the request.
 * @param depsNames              Dep names whose current values should also be
 *                               sent. Plain names read DOM inputs; the
 *                               `localStorage:`, `sessionStorage:`, `cookie:`,
 *                               `url:`, `telegram:cloud:` and `telegram:secure:`
 *                               prefixes read those client sources.
 * @param pathname               Path segment appended to `api/ajax_content`.
 * @param options                See {@link GetAjaxSubmitOptions}.
 * @returns An `async (extraKwargs?) => Promise<any>` submit function.
 */
export const getAjaxSubmit = (
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType,
    kwargs: Record<string, any> = {},
    depsNames: Array<string> = [],
    pathname?: string,
    options?: GetAjaxSubmitOptions
) => {
    const renderingLogEnabled = options?.renderingLogEnabled ?? false
    const timeout = options?.timeout
    const retryPolicy = options?.retryPolicy
    const maxRetries = retryPolicy?.maxRetries ?? 0
    const baseDelay = retryPolicy?.baseDelay ?? 1000
    const retryOn = retryPolicy?.retryOn ?? [502, 503, 504]

    if (renderingLogEnabled) {
        console.log('Registering AJAX: ', pathname, kwargs, depsNames)
    }

    return async (extraKwargs: Record<string, any> = {}) => {
        if (!clientSources.isClient()) {
            if (renderingLogEnabled) {
                console.warn(
                    'getAjaxSubmit called on server, skipping DOM-dependent logic'
                )
            }
            return
        }

        const apiServer = options?.apiServer
        if (!apiServer) {
            if (renderingLogEnabled) {
                console.warn('AJAX skipped: apiServer is missing')
            }
            return
        }

        if (!pathname || !setUiAjaxConfiguration) {
            if (renderingLogEnabled) {
                console.warn(
                    'AJAX skipped: pathname or setUiAjaxConfiguration is missing'
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
            const { key: fieldName } = parseDepName(depName)
            for (const value of await readAjaxKeyAsync(
                depName,
                renderingLogEnabled
            )) {
                data.append(fieldName, value)
            }
        }

        const apiEndpoint = apiServer + 'api/ajax_content' + pathname

        setUiAjaxConfiguration(null)

        let lastError: unknown
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                const delay = baseDelay * 2 ** (attempt - 1)
                if (renderingLogEnabled) {
                    console.log(
                        `AJAX retry ${attempt}/${maxRetries} after ${delay}ms`
                    )
                }
                await new Promise((r) => setTimeout(r, delay))
            }

            const controller = timeout != null ? new AbortController() : null
            const timer =
                controller && setTimeout(() => controller.abort(), timeout)

            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    body: data,
                    signal: controller?.signal,
                })

                if (timer) clearTimeout(timer)

                if (
                    !response.ok &&
                    retryOn.includes(response.status) &&
                    attempt < maxRetries
                ) {
                    lastError = new Error(`HTTP ${response.status}`)
                    continue
                }

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
            } catch (err) {
                if (timer) clearTimeout(timer)
                lastError = err
                if (attempt < maxRetries) continue
                if (renderingLogEnabled) {
                    console.error('AJAX request failed:', err)
                }
                setUiAjaxConfiguration(null)
                return err
            }
        }

        // All retries exhausted with a retryable HTTP status
        if (renderingLogEnabled) {
            console.error('AJAX request failed after retries:', lastError)
        }
        setUiAjaxConfiguration(null)
        return lastError
    }
}

/**
 * React hook wrapper around {@link getAjaxSubmit}. Reads `apiServer` and
 * `enableRenderingLog` from {@link usePieConfig} and memoizes the submit
 * function so that stable inline literals from server-driven UIConfig don't
 * cause a new function identity on every render — memoization is keyed on
 * the stringified `kwargs`/`depsNames` rather than their reference.
 *
 * @param setUiAjaxConfiguration Setter provided by the enclosing Ajax card.
 * @param kwargs                 Static key/value pairs appended to the request.
 * @param depsNames              Names of DOM inputs whose current values should
 *                               be sent alongside the request.
 * @param pathname               Path segment appended to `api/ajax_content`.
 * @param options                Optional `timeout` (ms) and `retryPolicy`.
 * @returns A memoized submit function; see {@link getAjaxSubmit}.
 */
export const useAjaxSubmit = (
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType,
    kwargs: Record<string, any> = {},
    depsNames: Array<string> = [],
    pathname?: string,
    options?: { timeout?: number; retryPolicy?: RetryPolicy }
) => {
    const { apiServer, enableRenderingLog } = usePieConfig()
    // kwargs/depsNames чаще всего приходят как инлайн-литералы из серверного
    // UIConfig — ссылка меняется на каждом рендере, поэтому ключом мемоизации
    // должно быть значение, а не ссылка.
    const kwargsKey = JSON.stringify(kwargs)
    const depsKey = JSON.stringify(depsNames)
    const optionsKey = JSON.stringify(options)
    return useMemo(
        () =>
            getAjaxSubmit(setUiAjaxConfiguration, kwargs, depsNames, pathname, {
                apiServer,
                renderingLogEnabled: enableRenderingLog,
                timeout: options?.timeout,
                retryPolicy: options?.retryPolicy,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            setUiAjaxConfiguration,
            kwargsKey,
            depsKey,
            pathname,
            apiServer,
            enableRenderingLog,
            optionsKey,
        ]
    )
}
