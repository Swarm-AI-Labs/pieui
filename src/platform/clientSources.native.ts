import { ClientSources } from './types'
import { getNativeClientConfig } from './nativeConfig'
import { readNativeField } from './nativeFormStore'

/**
 * React Native implementation of {@link ClientSources}. Reads from the sources
 * a host registers via {@link configureNativeClientSources}, with graceful
 * "missing value" defaults (`null` / `[]`) when a source is not wired — the
 * same semantics the web implementation produces for an absent input/key.
 *
 * The session id is held in module scope (set by `SocketIOInitProvider` via
 * `setSid`) rather than on a global `window`, which does not exist on native.
 */
let currentSid: string | undefined

export const nativeClientSources: ClientSources = {
    isClient() {
        return true
    },
    readSid() {
        return currentSid
    },
    setSid(sid) {
        currentSid = sid
    },
    readWebStorage(kind, key) {
        const cfg = getNativeClientConfig()
        const store = kind === 'local' ? cfg.storage : cfg.sessionStorage
        return store ? store.getItem(key) : null
    },
    async readWebStorageAsync(kind, key) {
        const cfg = getNativeClientConfig()
        const asyncStore =
            kind === 'local' ? cfg.asyncStorage : cfg.asyncSessionStorage
        if (asyncStore) return asyncStore.getItem(key)
        const syncStore = kind === 'local' ? cfg.storage : cfg.sessionStorage
        return syncStore ? syncStore.getItem(key) : null
    },
    readCookie(name) {
        const cfg = getNativeClientConfig()
        return cfg.getCookie ? cfg.getCookie(name) : null
    },
    readUrlParams(key) {
        const cfg = getNativeClientConfig()
        return cfg.getRouteParams ? cfg.getRouteParams(key) : []
    },
    readDomInput(name) {
        const cfg = getNativeClientConfig()
        return cfg.getInput ? cfg.getInput(name) : readNativeField(name)
    },
    submitGlobalForm() {
        const cfg = getNativeClientConfig()
        cfg.submitForm?.()
    },
}

export default nativeClientSources
