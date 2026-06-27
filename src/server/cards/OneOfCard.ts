import { Card } from '../card'
import type { OneOfCardData } from '../../components/Containers/OneOfCard/types'

/** One-of-N alternative container — 1:1 with the frontend OneOfCard. */
export class OneOfCard extends Card<OneOfCardData & { content: Card[] }> {}
