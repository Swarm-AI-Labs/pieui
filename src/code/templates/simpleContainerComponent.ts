export const simpleContainerComponentTemplate = (
    componentName: string
): string =>
    `import React, { useContext } from 'react'
import { PieCard, UI, UIRendererContext } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = ({
    data,
    content,
    setUiAjaxConfiguration,
}: ${componentName}Props) => {
    const { name } = data
    const Renderer = useContext(UIRendererContext) ?? UI

    return (
        <PieCard card='${componentName}' data={data}>
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
