import { PieSimpleComponentProps } from '../../../../types'

export interface SecureStorageCardData {
    name: string
    key: string
    value: string

    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}

export interface SecureStorageCardProps extends PieSimpleComponentProps<SecureStorageCardData> {}
