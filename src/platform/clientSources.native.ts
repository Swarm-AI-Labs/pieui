import { ClientSources, PlatformNotImplementedError } from './types'

/**
 * Placeholder React Native implementation. A later plan wires real native
 * sources (MMKV for sync storage, navigation params for url, an in-memory form
 * store, a sid context). Until then every accessor that has no safe default
 * throws, so an incomplete native integration fails loudly rather than silently
 * submitting empty data.
 */
const clientSources: ClientSources = {
    isClient() {
        return true
    },
    readSid() {
        return undefined
    },
    readWebStorage() {
        throw new PlatformNotImplementedError('readWebStorage')
    },
    readCookie() {
        throw new PlatformNotImplementedError('readCookie')
    },
    readUrlParams() {
        throw new PlatformNotImplementedError('readUrlParams')
    },
    readDomInput() {
        throw new PlatformNotImplementedError('readDomInput')
    },
    submitGlobalForm() {
        throw new PlatformNotImplementedError('submitGlobalForm')
    },
}

export default clientSources
