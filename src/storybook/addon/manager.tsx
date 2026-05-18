import * as React from 'react'
import { ReactElement } from 'react'
import { addons, types } from 'storybook/manager-api'
import { Panel } from './Panel'

// React import is used by classic JSX runtime (React.createElement / React.Fragment).
// Suppress an unused-import warning under strict TS configs that don't see it.
void React

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
