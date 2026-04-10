import { PieRootProps } from '../../PieRoot/types'
import { ReactNode } from 'react'

/**
 * Props accepted by {@link PieBaseRoot}. Extends {@link PieRootProps} with
 * a `children` slot — PieBaseRoot does not fetch a UI configuration on its
 * own, so the caller is responsible for rendering whatever should live
 * inside the PieUI providers.
 */
export type PieBaseRootProps = PieRootProps & {
    children?: ReactNode
}
