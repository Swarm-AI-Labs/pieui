import type { CardScaffoldOptions } from '../../../types'
import {
    ajaxSubmitDeclarationFor,
    dataDestructureFor,
    pieCardOpeningTagFor,
} from './shared'

export const simpleContainerComponentTemplate = (
    componentName: string,
    options: CardScaffoldOptions = {}
): string =>
    `import React, { useContext } from 'react'
import { PieCard, UI, UIRendererContext${options.ajax ? ', useAjaxSubmit' : ''} } from '@swarm.ing/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = ({
    data,
    content,
    setUiAjaxConfiguration,
}: ${componentName}Props) => {
    ${dataDestructureFor(options)}
    ${ajaxSubmitDeclarationFor(options)}
    const Renderer = useContext(UIRendererContext) ?? UI

    return (
        ${pieCardOpeningTagFor(componentName, options)}
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
                {content && (
                    <Renderer
                        uiConfig={content}
                        setUiAjaxConfiguration={setUiAjaxConfiguration}
                    />
                )}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
