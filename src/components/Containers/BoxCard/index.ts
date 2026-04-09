import { registerPieComponent } from '../../../util/registry'
import BoxCard from './ui/BoxCard'

export default registerPieComponent({
    name: 'BoxCard',
    component: BoxCard,
    metadata: {
        author: 'PieData',
        description: 'Simple div with styles joining few components',
    },
})
