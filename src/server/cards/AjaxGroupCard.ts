import { Card } from '../card'
import type { AjaxGroupCardData } from '../../components/Containers/AjaxGroupCard/types'

/** AJAX-enabled container (single child) — 1:1 with the frontend AjaxGroupCard. */
export class AjaxGroupCard extends Card<AjaxGroupCardData & { content: Card }> {}
