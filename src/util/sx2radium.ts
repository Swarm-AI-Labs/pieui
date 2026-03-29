import { CSSProperties } from 'react'

/**
 * Converts sx-style objects to CSSProperties.
 * Note: CSS keyframe animations defined as objects in `animationName`
 * are no longer supported after Radium removal. Use CSS @keyframes instead.
 */
export function sx2radium(
    sx: Record<string, any> | CSSProperties | undefined
): CSSProperties {
    if (!sx) {
        return {}
    }

    return { ...sx } as CSSProperties
}