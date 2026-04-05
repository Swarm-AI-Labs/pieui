export const complexComponentTemplate = (componentName: string): string =>
    `import React from 'react'
import { PieCard } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName} = ({ data }: ${componentName}Props) => {
    const { name } = data

    return (
        <PieCard card='${componentName}' data={data}>
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
