'use client'

export const submitGlobalForm = () => {
    if (typeof document === 'undefined') return

    const formElement = document.getElementById(
        'piedata_global_form'
    ) as HTMLFormElement
    formElement && formElement.submit()
}