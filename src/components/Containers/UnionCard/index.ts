import { registerPieComponent } from '../../../util/registry'
import UnionCard from './ui/UnionCard'

export default registerPieComponent({
    name: 'UnionCard',
    component: UnionCard,
    metadata: {
        author: 'PieData',
        description: 'Renders one of many components',
    },
})
