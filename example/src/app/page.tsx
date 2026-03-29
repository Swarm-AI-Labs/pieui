'use client'

import { PieBaseRoot, UI, type UIConfigType } from '@piedata/pieui'
import '@/components/initComponents'

const staticConfig: UIConfigType = {
    card: 'SequenceCard',
    data: {},
    content: [
        {
            card: 'HelloCard',
            data: {
                title: 'Welcome to PieUI',
                description:
                    'This is a server-driven UI rendered from a static UIConfigType.',
            },
            content: [] as unknown as UIConfigType,
        },
        {
            card: 'InfoCard',
            data: { label: 'Framework', value: 'Next.js + PieUI' },
            content: [] as unknown as UIConfigType,
        },
        {
            card: 'InfoCard',
            data: { label: 'Mode', value: 'Static Configuration' },
            content: [] as unknown as UIConfigType,
        },
    ],
}

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                PieUI Example
            </h1>
            <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
                Server-driven UI rendered from a static config. In production,
                use{' '}
                <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm dark:bg-zinc-800">
                    PieRoot
                </code>{' '}
                to fetch config from your API.
            </p>

            <div className="w-full max-w-lg space-y-4">
                <PieBaseRoot
                    location={{ pathname: '/', search: '' }}
                    config={{ apiServer: 'http://localhost:8008/' }}
                    initializePie={() => {}}
                >
                    <UI uiConfig={staticConfig} />
                </PieBaseRoot>
            </div>
        </div>
    )
}
