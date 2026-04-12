import { PieSimpleComponentProps } from '../../../../types'

export interface DeviceStorageCardData {
    name: string
    key: string
    value: string

    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}

export interface DeviceStorageCardProps
    extends PieSimpleComponentProps<DeviceStorageCardData> {}