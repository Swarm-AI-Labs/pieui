import { ReactElement } from 'react'
import { addons, types } from 'storybook/manager-api'
import { Panel } from './Panel'

const ADDON_ID = 'piecard'
const PANEL_ID = `${ADDON_ID}/panel`

addons.register(ADDON_ID, () => {
    addons.add(PANEL_ID, {
        type: types.PANEL,
        title: 'PieCard Methods',
        match: ({ viewMode }: { viewMode?: string }) => viewMode === 'story',
        render: ({ active }: { active?: boolean }): ReactElement | null =>
            Panel({ active }),
    })
})
