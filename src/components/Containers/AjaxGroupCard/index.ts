import { registerPieComponent } from '../../../util/registry'
import AjaxGroupCard from './ui/AjaxGroupCard'

export default registerPieComponent({
    name: 'AjaxGroupCard',
    component: AjaxGroupCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Group card with AJAX support',
    },
})
