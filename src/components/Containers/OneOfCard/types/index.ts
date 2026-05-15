import { CSSProperties } from 'react'
import { PieComplexContainerComponentProps } from '../../../../types'

export interface OneOfCardData {
    name: string
    sx: CSSProperties
}

export interface OneOfCardProps extends PieComplexContainerComponentProps<OneOfCardData> {}
