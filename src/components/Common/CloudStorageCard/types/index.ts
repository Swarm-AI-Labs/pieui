import { PieSimpleComponentProps } from '../../../../types'

export interface CloudStorageCardData {
    name: string
    key: string
    value: string

    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}

export interface CloudStorageCardProps
    extends PieSimpleComponentProps<CloudStorageCardData> {}