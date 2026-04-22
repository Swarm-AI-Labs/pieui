import {
    getProjectComponentsApiUrl,
    getStorageConfig,
    getStorageHeaders,
    type ProjectComponentList,
    responseError,
} from '../storageApi'

export const remoteListCommand = async (
    remoteUserId?: string,
    remoteProjectSlug?: string
) => {
    const config = getStorageConfig({
        userId: remoteUserId,
        projectSlug: remoteProjectSlug,
    })
    const url = getProjectComponentsApiUrl(config)

    console.log(`[pieui] Listing remote components from: ${url}`)

    const response = await fetch(url, {
        method: 'GET',
        headers: getStorageHeaders(config),
    })

    if (!response.ok) {
        throw await responseError('remote-list', response)
    }

    const body = (await response.json()) as ProjectComponentList
    const components = [...body.components].sort((a, b) =>
        a.name.localeCompare(b.name)
    )

    if (components.length === 0) {
        console.log(
            `[pieui] No remote components found for ${body.user_id}/${body.project_slug}`
        )
        return
    }

    console.log(
        `[pieui] Remote components for ${body.user_id}/${body.project_slug}:`
    )
    for (const component of components) {
        console.log(component.name)
    }
}
