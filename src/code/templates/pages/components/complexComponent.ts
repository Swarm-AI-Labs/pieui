import type { CardScaffoldOptions } from '../../../types'
import {
    ajaxSubmitDeclarationFor,
    dataDestructureFor,
    pieCardOpeningTagFor,
} from './shared'

export const complexComponentTemplate = (
    componentName: string,
    options: CardScaffoldOptions = {}
): string => {
    const propsDestructure = options.input
        ? `{ data, stored${options.ajax ? ', setUiAjaxConfiguration' : ''} }`
        : `{ data${options.ajax ? ', setUiAjaxConfiguration' : ''} }`
    return `import React from 'react'
import { PieCard${options.ajax ? ', useAjaxSubmit' : ''} } from '@swarm.ing/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = (${propsDestructure}: ${componentName}Props) => {
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
