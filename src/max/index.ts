'use client'

/**
 * MAX (VK Messenger) mini-app integration entry.
 *
 * `PieMaxRoot` and the MAX `WebApp` hooks are intentionally split out of the
 * main `@swarm.ing/pieui` barrel so that apps which do not target MAX never
 * reference this code from the main entry point. Import from
 * `@swarm.ing/pieui/max` when building a MAX mini-app.
 */
export { default as PieMaxRoot } from '../components/PieMaxRoot'
export {
    useMaxWebApp,
    useMaxInitData,
    useMaxBackButton,
    useMaxHapticFeedback,
} from '../util/useMaxWebApp'

export type {
    MaxWebApp,
    MaxWebAppData,
    MaxWebAppUser,
    MaxWebAppChat,
    MaxWebAppStartParam,
} from '../types'
