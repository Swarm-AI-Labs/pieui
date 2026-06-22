'use client'

/**
 * Registers the built-in React Native card variants under their canonical names
 * (so server-driven `UIConfig` referencing `BoxCard`, `IOEventsCard`, … resolves
 * to the RN implementation), and re-registers the cards that are already
 * platform-agnostic by importing their web modules (whose `index.ts` self-
 * register on import).
 *
 * Importing this module is a side effect; the native barrel (`../index.ts`)
 * imports it so a host gets the native cards just by loading
 * `@swarm.ing/pieui/native`.
 */
import { registerPieComponent } from '../../util/registry'

import BoxCard from './BoxCard'
import SequenceCard from './SequenceCard'
import OneOfCard from './OneOfCard'
import HiddenCard from './HiddenCard'
import DeviceStorageCard from './DeviceStorageCard'
import SessionStorageCard from './SessionStorageCard'
import IOEventsCard from './IOEventsCard'
import HTMLEmbedCard from './HTMLEmbedCard'
import AutoRedirectCard from './AutoRedirectCard'

// Already platform-agnostic — reuse the web components directly. Imported as
// values (not bare side-effect imports) so the bundler/minifier cannot drop the
// registration; `sideEffects` only marks CSS, so a bare `import '…'` would be
// tree-shaken out of the pre-bundled native entry.
import UnionCard from '../../components/Containers/UnionCard/ui/UnionCard'
import AjaxGroupCard from '../../components/Containers/AjaxGroupCard/ui/AjaxGroupCard'

const NATIVE_CARDS: Array<{ name: string; component: any }> = [
    { name: 'BoxCard', component: BoxCard },
    { name: 'SequenceCard', component: SequenceCard },
    { name: 'OneOfCard', component: OneOfCard },
    { name: 'HiddenCard', component: HiddenCard },
    { name: 'DeviceStorageCard', component: DeviceStorageCard },
    { name: 'SessionStorageCard', component: SessionStorageCard },
    { name: 'IOEventsCard', component: IOEventsCard },
    { name: 'HTMLEmbedCard', component: HTMLEmbedCard },
    { name: 'AutoRedirectCard', component: AutoRedirectCard },
    { name: 'UnionCard', component: UnionCard },
    { name: 'AjaxGroupCard', component: AjaxGroupCard },
]

for (const card of NATIVE_CARDS) {
    registerPieComponent(card)
}

export {
    BoxCard,
    SequenceCard,
    OneOfCard,
    HiddenCard,
    DeviceStorageCard,
    SessionStorageCard,
    IOEventsCard,
    HTMLEmbedCard,
    AutoRedirectCard,
    UnionCard,
    AjaxGroupCard,
}
