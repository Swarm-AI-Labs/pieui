'use client'

import mitt, { Emitter } from 'mitt'
import { createContext } from 'react'

export type MittEvents = {
    [key: string]: any
}

let _emitter: Emitter<MittEvents> | null = null

export function getEmitter(): Emitter<MittEvents> {
    if (!_emitter) {
        _emitter = mitt<MittEvents>()
    }
    return _emitter
}

const MittContext = createContext<Emitter<MittEvents> | null>(null)

export default MittContext
