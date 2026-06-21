'use client'

import clientSources from '../platform/clientSources'

/**
 * Submits the hidden global PieUI form (`#piedata_global_form`) that is
 * rendered by every PieRoot variant. Delegates to the active platform's
 * `ClientSources` implementation, which no-ops when the form is not mounted
 * (and on the server). On React Native there is no HTML form; the native
 * implementation supplies its own submission strategy.
 */
export const submitGlobalForm = () => {
    clientSources.submitGlobalForm()
}
