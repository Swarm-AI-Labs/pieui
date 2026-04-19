import type { CardScaffoldOptions } from '../../../types'
import {
    ajaxSubmitDeclarationFor,
    dataDestructureFor,
    pieCardOpeningTagFor,
} from './shared'

export const simpleComponentTemplate = (
    componentName: string,
    options: CardScaffoldOptions = {}
): string =>
    `import React from 'react'
import { PieCard${options.ajax ? ', useAjaxSubmit, type SetUiAjaxConfigurationType' : ''} } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = ({ data${options.ajax ? ', setUiAjaxConfiguration' : ''} }: ${componentName}Props${options.ajax ? ' & { setUiAjaxConfiguration?: SetUiAjaxConfigurationType }' : ''}) => {
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
