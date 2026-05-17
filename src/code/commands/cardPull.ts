import { cardRemotePullCommand } from './cardRemote/pull'

export const cardPullCommand = async (cardRef: string): Promise<void> => {
    await cardRemotePullCommand(cardRef)
}