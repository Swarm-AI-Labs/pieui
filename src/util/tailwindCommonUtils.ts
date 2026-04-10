import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges a list of Tailwind CSS class name inputs into a single deduplicated
 * class string.
 *
 * First runs `clsx` to flatten arrays, booleans and object shorthand into a
 * flat list, then pipes the result through `tailwind-merge` so that later
 * utilities override earlier ones on the same property (e.g. `px-2 px-4`
 * collapses to `px-4`). This is the canonical PieUI helper for composing
 * className props.
 *
 * @param inputs Any combination of strings, arrays, objects or falsy values
 *               accepted by `clsx`.
 * @returns A merged, whitespace-separated class name string.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
