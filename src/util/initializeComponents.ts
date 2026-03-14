import { registerPieComponent } from './registry'

// Import all components that need registration
import {SequenceCard} from '../components'
import {UnionCard} from '../components'
import {AjaxGroupCard} from '../components'

import {AjaxButtonCard} from '../components'

import {ChatCard} from '../components'
import {HiddenCard} from '../components'
import {AutoRedirectCard} from '../components'
import {HTMLEmbedCard} from '../components'
import {IOEventsCard} from '../components'
import {RedirectButtonCard} from '../components'
import { OpenAIVoiceAgentCard } from '../components'
import {TableCard} from '../components'
import {BoxCard} from '../components'

let initialized = false

/**
 * Initialize all PieUI components by registering them in the component registry.
 * This function should be called once before using PieRoot or any dynamic components.
 *
 * @example
 * ```typescript
 * import { initializePieComponents } from 'pieui'
 *
 * // Call this once in your app initialization
 * initializePieComponents()
 * ```
 */
export function initializePieComponents(): void {
    if (initialized) {
        return
    }

    // Register all built-in components
    registerPieComponent({
        name: 'SequenceCard',
        component: SequenceCard,
        metadata: {
            author: 'PieData',
            description: 'Simple div with styles joining few components',
        },
    })

    registerPieComponent({
        name: 'BoxCard',
        component: BoxCard,
        metadata: {
            author: 'PieData',
            description: 'Simple div with styles joining few components',
        },
    })

    registerPieComponent({
        name: 'UnionCard',
        component: UnionCard,
        metadata: {
            author: 'PieData',
            description: 'Renders one of many components',
        },
    })

    registerPieComponent({
        name: 'AjaxGroupCard',
        component: AjaxGroupCard,
        metadata: {
            author: 'PieData',
            description: 'Group card with AJAX support',
        },
    })

    registerPieComponent({
        name: 'AjaxButtonCard',
        component: AjaxButtonCard,
        metadata: {
            author: 'PieData',
            description: 'Button with AJAX support',
        },
    })

    registerPieComponent({
        name: 'RedirectButtonCard',
        component: RedirectButtonCard,
        metadata: {
            author: 'PieData',
            description: 'Button with Redirect on click',
        },
    })

    registerPieComponent({
        name: 'ChatCard',
        component: ChatCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'HiddenCard',
        component: HiddenCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'AutoRedirectCard',
        component: AutoRedirectCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'HTMLEmbedCard',
        component: HTMLEmbedCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'IOEventsCard',
        component: IOEventsCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'OpenAIVoiceAgentCard',
        component: OpenAIVoiceAgentCard,
        metadata: {
            author: 'PieData',
        },
    })

    registerPieComponent({
        name: 'TableCard',
        component: TableCard,
        metadata: {
            author: 'PieData',
        },
    })

    initialized = true
}

/**
 * Check if PieUI components have been initialized
 */
export function isPieComponentsInitialized(): boolean {
    return initialized
}
