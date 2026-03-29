'use client'

import { createContext, ReactNode } from 'react'

const FallbackContext = createContext<ReactNode>(<></>)

export default FallbackContext
