/**
 * The set of client-side capabilities the AJAX/form layer depends on. The web
 * build supplies a DOM-backed implementation; React Native supplies its own.
 * Methods are pure accessors — all logging/warning lives in the callers so the
 * platform layer stays environment-agnostic.
 */
export interface ClientSources {
    /** True only when client-side APIs are usable (mirrors the SSR guard). */
    isClient(): boolean
    /** SocketIO session id, or undefined when not yet initialized. */
    readSid(): string | undefined
    /**
     * Reads a value from local/session storage. May throw (e.g. blocked in
     * private mode); the caller is responsible for catching.
     */
    readWebStorage(kind: 'local' | 'session', key: string): string | null
    /** Reads and URL-decodes a single cookie; null when absent. */
    readCookie(name: string): string | null
    /** Reads every value for a repeated URL query param. */
    readUrlParams(key: string): string[]
    /**
     * Reads DOM input(s) by name. Returns `null` when no element has that name
     * (so the caller can warn), the selected `File`s for a file input, the
     * `.value` for other inputs/textareas, or `[]` for an unsupported element.
     */
    readDomInput(name: string): Array<string | File> | null
    /** Submits the hidden global form (`#piedata_global_form`). No-op if unmounted. */
    submitGlobalForm(): void
}

/** Thrown by platform stubs for capabilities not yet implemented on a target. */
export class PlatformNotImplementedError extends Error {
    constructor(method: string) {
        super(`ClientSources.${method} is not implemented on this platform`)
        this.name = 'PlatformNotImplementedError'
    }
}
