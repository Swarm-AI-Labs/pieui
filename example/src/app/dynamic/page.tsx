'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PieRoot } from '@swarm.ing/pieui'
import '@/components/initComponents'

function DynamicContent() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    return (
        <PieRoot
            location={{
                pathname,
                search: searchParams.toString(),
            }}
            config={{
                apiServer: 'http://localhost:8008/',
            }}
            fallback={
                <div className="flex min-h-[50vh] items-center justify-center">
                    <p className="text-zinc-500">Loading UI configuration...</p>
                </div>
            }
            initializePie={() => {
                console.log('PieUI initialized')
            }}
        />
    )
}

export default function DynamicPage() {
    return (
        <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
            <Suspense
                fallback={
                    <div className="flex min-h-[50vh] items-center justify-center">
                        <p className="text-zinc-500">Loading...</p>
                    </div>
                }
            >
                <DynamicContent />
            </Suspense>
        </div>
    )
}
