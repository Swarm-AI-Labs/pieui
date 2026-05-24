import type { CardScaffoldOptions } from '../../../types'
import {
    ajaxSubmitDeclarationFor,
    dataDestructureFor,
    pieCardOpeningTagFor,
} from './shared'

export const simpleComponentTemplate = (
    componentName: string,
    options: CardScaffoldOptions = {}
): string => {
    const propsDestructure = options.input
        ? `{ data, stored${options.ajax ? ', setUiAjaxConfiguration' : ''} }`
        : `{ data${options.ajax ? ', setUiAjaxConfiguration' : ''} }`
    const propsAnnotation = options.ajax
        ? `${componentName}Props & { setUiAjaxConfiguration?: SetUiAjaxConfigurationType }`
        : `${componentName}Props`
    return `import React from 'react'
import { PieCard${options.ajax ? ', useAjaxSubmit, type SetUiAjaxConfigurationType' : ''} } from '@swarm.ing/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = (${propsDestructure}: ${propsAnnotation}) => {
    ${dataDestructureFor(options)}
    ${ajaxSubmitDeclarationFor(options)}

    return (
        ${pieCardOpeningTagFor(componentName, options)}
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
}
