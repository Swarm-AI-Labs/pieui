import { CardScaffoldOptions, ComponentType } from '../../types'
import {
    complexComponentTemplate,
    complexContainerComponentTemplate,
    simpleComponentTemplate,
    simpleContainerComponentTemplate,
} from './components'
import { pageTemplate } from './page'

const BASE_INTERFACE_BY_TYPE: Record<ComponentType, string> = {
    simple: 'PieSimpleComponentProps',
    complex: 'PieComplexComponentProps',
    'simple-container': 'PieContainerComponentProps',
    'complex-container': 'PieComplexContainerComponentProps',
}

export { pageTemplate }

export const baseInterfaceFor = (componentType: ComponentType): string =>
    BASE_INTERFACE_BY_TYPE[componentType]

export const componentTemplateFor = (
    componentType: ComponentType,
    componentName: string,
    options: CardScaffoldOptions = {}
): string => {
    switch (componentType) {
        case 'simple':
            return simpleComponentTemplate(componentName, options)
        case 'complex':
            return complexComponentTemplate(componentName, options)
        case 'simple-container':
            return simpleContainerComponentTemplate(componentName, options)
        case 'complex-container':
        default:
            return complexContainerComponentTemplate(componentName, options)
    }
}
