import { registerPieComponent } from '../../../util/registry'
import AjaxGroupCard from './ui/AjaxGroupCard'

export default registerPieComponent({
    name: 'AjaxGroupCard',
    component: AjaxGroupCard,
    metadata: {
        author: 'PieData',
        description: 'Group card with AJAX support',
    },
})
