import { Card } from '../card'
import type { UnionCardData } from '../../components/Containers/UnionCard/types'

/** Container of child cards — 1:1 with the frontend UnionCard. */
export class UnionCard extends Card<UnionCardData & { content: Card[] }> {}
