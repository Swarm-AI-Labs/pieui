import { registerPieComponent } from '../../../util/registry'
import OneOfCard from './ui/OneOfCard.tsx'

export default registerPieComponent({
    name: 'SequenceCard',
    component: OneOfCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Simple div with styles joining few components',
    },
})
