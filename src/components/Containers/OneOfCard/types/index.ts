import { CSSProperties } from 'react'
import { PieComplexContainerComponentProps } from '../../../../types'

export interface SequenceCardData {
    name: string
    sx: CSSProperties
}

export interface SequenceCardProps extends PieComplexContainerComponentProps<SequenceCardData> {}
