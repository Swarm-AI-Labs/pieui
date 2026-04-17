import { registerPieComponent } from '../../../util/registry'
import BoxCard from './ui/BoxCard'

export default registerPieComponent({
    name: 'BoxCard',
    component: BoxCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Simple div with styles joining few components',
    },
})
