'use client'

import {
    registerPieComponent,
    type PieSimpleComponentProps,
} from '@piedata/pieui'

interface HelloData {
    title: string
    description?: string
}

function HelloCard({ data }: PieSimpleComponentProps<HelloData>) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {data.title}
            </h2>
            {data.description && (
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    {data.description}
                </p>
            )}
        </div>
    )
}

registerPieComponent({
    name: 'HelloCard',
    component: HelloCard,
})

export default HelloCard
