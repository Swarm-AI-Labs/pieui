export const componentTypesTemplate = (
    componentName: string,
    baseInterface: string
): string => `import { ${baseInterface} } from '@piedata/pieui'

export interface ${componentName}Data {
    name: string
    // Add your component-specific props here
}

export type ${componentName}Props = ${baseInterface}<${componentName}Data>
`