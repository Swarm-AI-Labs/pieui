'use client'

/**
 * Submits the hidden global PieUI form (`#piedata_global_form`) that is
 * rendered by every PieRoot variant. All PieUI inputs live inside this form,
 * so calling this function triggers a native multipart POST to the server
 * endpoint wired up at render time (usually `/api/process{pathname}`).
 *
 * No-ops on the server and when the form element has not been mounted yet.
 */
export const submitGlobalForm = () => {
    if (typeof document === 'undefined') return

    const formElement = document.getElementById(
        'piedata_global_form'
    ) as HTMLFormElement
    formElement && formElement.submit()
}
