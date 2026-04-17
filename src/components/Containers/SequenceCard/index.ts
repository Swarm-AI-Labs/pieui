import { registerPieComponent } from '../../../util/registry'
import SequenceCard from './ui/SequenceCard'

export default registerPieComponent({
    name: 'SequenceCard',
    component: SequenceCard,
    metadata: {
        author: 'Swarm.ing',
        description: 'Simple div with styles joining few components',
    },
})
