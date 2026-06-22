/**
 * In-memory form-field store for React Native.
 *
 * On the web, hidden/storage cards render `<input name>` so DOM-based dep
 * collection (`document.getElementsByName`) finds their values. There is no DOM
 * on native, so the native variants of those cards write their value(s) here
 * instead, keyed by field name. The native `ClientSources.readDomInput` reads
 * back from this store (when the host has not provided its own `getInput`), so
 * a plain dep name resolves exactly as it would from a hidden input on web.
 */
const fields = new Map<string, Array<string | File>>()

/** Registers (replaces) the current value(s) for a field name. */
export const setNativeField = (
    name: string,
    values: Array<string | File>
): void => {
    fields.set(name, values)
}

/** Removes a field from the store. */
export const clearNativeField = (name: string): void => {
    fields.delete(name)
}

/**
 * Reads the value(s) registered for a field name, or `null` when no field by
 * that name exists — mirroring "element not found" so the caller can warn.
 */
export const readNativeField = (
    name: string
): Array<string | File> | null => {
    return fields.has(name) ? fields.get(name)! : null
}

/** Test helper: empties the store. */
export const resetNativeFields = (): void => {
    fields.clear()
}
