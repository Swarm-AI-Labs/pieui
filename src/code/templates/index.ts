import { ComponentType } from '../types'
import { componentIndexTemplate } from './componentIndex'
import { componentTypesTemplate } from './componentTypes'
import { registerCallTemplate } from './registerCall'
import { simpleComponentTemplate } from './simpleComponent'
import { complexComponentTemplate } from './complexComponent'
import { simpleContainerComponentTemplate } from './simpleContainerComponent'
import { complexContainerComponentTemplate } from './complexContainerComponent'

export { componentIndexTemplate, componentTypesTemplate, registerCallTemplate }

const BASE_INTERFACE_BY_TYPE: Record<ComponentType, string> = {
    simple: 'PieSimpleComponentProps',
    complex: 'PieComplexComponentProps',
    'simple-container': 'PieContainerComponentProps',
    'complex-container': 'PieComplexContainerComponentProps',
}

export const baseInterfaceFor = (componentType: ComponentType): string =>
    BASE_INTERFACE_BY_TYPE[componentType]

export const componentTemplateFor = (
    componentType: ComponentType,
    componentName: string
): string => {
    switch (componentType) {
        case 'simple':
            return simpleComponentTemplate(componentName)
        case 'complex':
            return complexComponentTemplate(componentName)
        case 'simple-container':
            return simpleContainerComponentTemplate(componentName)
        case 'complex-container':
        default:
            return complexContainerComponentTemplate(componentName)
    }
}