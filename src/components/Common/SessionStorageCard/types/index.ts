import { PieSimpleComponentProps } from '../../../../types'

export interface SessionStorageCardData {
    name: string
    key: string
    value: string

    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}

export interface SessionStorageCardProps extends PieSimpleComponentProps<SessionStorageCardData> {}
