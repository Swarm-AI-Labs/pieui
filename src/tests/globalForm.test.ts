import { describe, test, expect, mock } from 'bun:test'
import { submitGlobalForm } from '../util/globalForm'

describe('submitGlobalForm()', () => {
    test('does not throw when form element does not exist', () => {
        expect(() => submitGlobalForm()).not.toThrow()
    })

    test('calls submit() on the form when it exists', () => {
        const mockSubmit = mock(() => {})
        const form = document.createElement('form')
        form.id = 'piedata_global_form'
        form.submit = mockSubmit
        document.body.appendChild(form)

        submitGlobalForm()
        expect(mockSubmit).toHaveBeenCalledTimes(1)

        document.body.removeChild(form)
    })
})