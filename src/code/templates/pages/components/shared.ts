import type { CardScaffoldOptions } from '../../../types'

export const dataDestructureFor = (
    options: CardScaffoldOptions = {}
): string => {
    if (!options.io && !options.ajax) {
        return 'const { name } = data'
    }

    const fields = ['name']

    if (options.io) {
        fields.push(
            'useSocketioSupport',
            'useCentrifugeSupport',
            'useMittSupport',
            'centrifugeChannel'
        )
    }

    if (options.ajax) {
        fields.push('pathname', 'depsNames', 'kwargs')
    }

    return `const {
    ${fields.join(',\n    ')},
} = data`
}

export const pieCardOpeningTagFor = (
    componentName: string,
    options: CardScaffoldOptions = {}
): string => {
    if (!options.io) {
        return `<PieCard card='${componentName}' data={data}>`
    }

    return `<PieCard
            card='${componentName}'
            data={data}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
            methods={{
            }}
        >`
}

export const ajaxSubmitDeclarationFor = (
    options: CardScaffoldOptions = {}
): string => {
    if (!options.ajax) {
        return ''
    }

    return `
    const ajaxSubmit = useAjaxSubmit(
        setUiAjaxConfiguration,
        kwargs,
        depsNames,
        pathname
    )`
}
