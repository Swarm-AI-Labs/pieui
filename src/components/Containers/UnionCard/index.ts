import { registerPieComponent } from '../../../util/registry'
import UnionCard from './ui/UnionCard'

export default registerPieComponent({
    name: 'UnionCard',
    component: UnionCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Renders one of many components',
    },
})
