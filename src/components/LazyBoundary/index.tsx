'use client'

import { Component, ReactNode, Suspense } from 'react'

/**
 * Error boundary + Suspense wrapper for a single lazy (code-split) card.
 *
 * A `React.lazy` chunk can fail to load — a flaky network, or (commonly) a
 * fresh deploy that changed chunk hashes so the running tab requests a chunk
 * that now 404s. A bare `<Suspense>` does NOT catch that: the error propagates
 * and white-screens the tree. This boundary instead:
 *
 *   1. renders the card's `fallback` (its skeleton) instead of crashing,
 *   2. retries the import a couple of times with backoff — remounting the
 *      Suspense subtree, which re-runs the loader (the module cache evicts a
 *      rejected promise, so the retry is a fresh attempt), and
 *   3. calls `onError` so the host can recover from a stale deploy (e.g. a
 *      one-shot page reload).
 *
 * If the retries are exhausted it stays on the fallback rather than throwing,
 * so one broken card never takes down the whole screen.
 */

type Props = {
    /** Stable key (the card name) — resets the boundary if the card changes. */
    name: string
    /** Shown while loading and as the give-up state (the card's skeleton). */
    fallback: ReactNode
    /** Called on each caught chunk error, after retries are scheduled. */
    onError?: (error: unknown) => void
    children: ReactNode
}

type State = { failed: boolean; attempt: number }

const MAX_RETRIES = 2
const RETRY_BASE_MS = 400

export default class LazyBoundary extends Component<Props, State> {
    state: State = { failed: false, attempt: 0 }
    private timer: ReturnType<typeof setTimeout> | undefined

    static getDerivedStateFromError(): Partial<State> {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        this.props.onError?.(error)
        if (this.state.attempt < MAX_RETRIES) {
            const delay = RETRY_BASE_MS * (this.state.attempt + 1)
            this.timer = setTimeout(() => {
                // Bump `attempt` → new Suspense key → remount → re-import.
                this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))
            }, delay)
        }
    }

    componentDidUpdate(prevProps: Props) {
        // A different card now occupies this slot — reset retry state.
        if (prevProps.name !== this.props.name && this.state.attempt !== 0) {
            this.setState({ failed: false, attempt: 0 })
        }
    }

    componentWillUnmount() {
        if (this.timer) clearTimeout(this.timer)
    }

    render() {
        if (this.state.failed) return this.props.fallback
        return (
            <Suspense
                key={`${this.props.name}:${this.state.attempt}`}
                fallback={this.props.fallback}
            >
                {this.props.children}
            </Suspense>
        )
    }
}
