'use client'

import '../types' // ambient `window.sid` / `window.Telegram` augmentation
import { ClientSources } from './types'

const readCookie = (name: string): string | null => {
    const cookies = document.cookie ? document.cookie.split(';') : []
    for (const cookie of cookies) {
        const eq = cookie.indexOf('=')
        const cookieName = (eq === -1 ? cookie : cookie.slice(0, eq)).trim()
        if (cookieName === name) {
            const raw = eq === -1 ? '' : cookie.slice(eq + 1).trim()
            try {
                return decodeURIComponent(raw)
            } catch {
                return raw
            }
        }
    }
    return null
}

/**
 * Browser/DOM implementation of {@link ClientSources}. Selected at runtime by
 * the `clientSources` resolver on web and during SSR (its methods guard their
 * own `typeof window`/`document` access).
 */
export const webClientSources: ClientSources = {
    isClient() {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
    },
    readSid() {
        return typeof window === 'undefined' ? undefined : window.sid
    },
    setSid(sid) {
        if (typeof window !== 'undefined') window.sid = sid
    },
    readWebStorage(kind, key) {
        const store =
            kind === 'local' ? window.localStorage : window.sessionStorage
        return store.getItem(key)
    },
    readCookie,
    readUrlParams(key) {
        return new URLSearchParams(window.location.search).getAll(key)
    },
    readDomInput(name) {
        const inputs = document.getElementsByName(name)
        if (!inputs.length) return null
        const input = inputs[0]
        if (input instanceof HTMLInputElement) {
            if (input.type === 'file' && input.files) {
                return Array.from(input.files)
            }
            return [input.value]
        }
        if (input instanceof HTMLTextAreaElement) {
            return [input.value]
        }
        return []
    },
    submitGlobalForm() {
        if (typeof document === 'undefined') return
        const formElement = document.getElementById(
            'piedata_global_form'
        ) as HTMLFormElement
        formElement && formElement.submit()
    },
}

export default webClientSources
