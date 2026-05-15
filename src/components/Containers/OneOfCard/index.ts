import { registerPieComponent } from '../../../util/registry'
import OneOfCard from './ui/OneOfCard.tsx'

export default registerPieComponent({
    name: 'OneOfCard',
    component: OneOfCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Different variants',
    },
})
