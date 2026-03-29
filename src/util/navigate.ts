'use client'

import { createContext } from 'react'

export type NavigateFunction = (_: string) => void

const NavigateContext = createContext<NavigateFunction | undefined>(undefined)

export default NavigateContext
