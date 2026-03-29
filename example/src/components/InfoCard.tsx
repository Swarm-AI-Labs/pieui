'use client'

import {
    registerPieComponent,
    type PieSimpleComponentProps,
} from '@piedata/pieui'

interface InfoData {
    label: string
    value: string
}

function InfoCard({ data }: PieSimpleComponentProps<InfoData>) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {data.label}
            </span>
            <p className="mt-1 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {data.value}
            </p>
        </div>
    )
}

registerPieComponent({
    name: 'InfoCard',
    component: InfoCard,
})

export default InfoCard
