import type { CardScaffoldOptions } from '../types'

const ioFields = `    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string`

const ajaxFields = `    pathname?: string
    depsNames: string[]
    kwargs: Record<string, string | number | boolean>`

const storedInterfaceFor = (componentName: string): string =>
    `export interface ${componentName}Stored {
    // Add the fields you want submitted as the form value (\`stored\` prop)
}`

export const componentTypesTemplate = (
    componentName: string,
    baseInterface: string,
    options: CardScaffoldOptions = {}
): string => {
    const extraSections = [
        options.io ? ioFields : '',
        options.ajax ? ajaxFields : '',
    ]
        .filter(Boolean)
        .join('\n\n')
    const extraFields = extraSections ? `\n\n${extraSections}` : ''

    const storedBlock = options.input
        ? `\n${storedInterfaceFor(componentName)}\n`
        : ''
    const propsAlias = options.input
        ? `export type ${componentName}Props = ${baseInterface}<${componentName}Data, ${componentName}Stored>`
        : `export type ${componentName}Props = ${baseInterface}<${componentName}Data>`

    return `import { ${baseInterface} } from '@swarm.ing/pieui'

export interface ${componentName}Data {
    name: string
    // Add your component-specific props here
${extraFields}
}
${storedBlock}
${propsAlias}
`
}
