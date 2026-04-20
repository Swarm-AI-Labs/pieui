import {
    formatRemoteName,
    getComponentApiUrl,
    getStorageConfig,
    getStorageHeaders,
    responseError,
} from '../storageApi'

export const remoteRemoveCommand = async (componentName: string) => {
    const config = getStorageConfig()
    const componentUrl = getComponentApiUrl(config, componentName)
    const remoteName = formatRemoteName(config, componentName)

    console.log(`[pieui] Removing from: ${componentUrl}`)

    const response = await fetch(componentUrl, {
        method: 'DELETE',
        headers: getStorageHeaders(config),
    })

    if (!response.ok) {
        throw await responseError('remote-remove', response)
    }

    console.log(`[pieui] Remote remove completed: ${remoteName}`)
}

