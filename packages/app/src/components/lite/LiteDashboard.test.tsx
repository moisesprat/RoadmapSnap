// Golden-markup test (D-01): the React dashboard must equal Lite's renderDashboard for the same core model.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { buildDashboardModel } from '@roadmapsnap/core'
import { LiteDashboard } from './LiteDashboard'
import { normalizeHtmlString, normalizeMarkup } from '../../test/goldenMarkup'
import { liteModelFor } from '../../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { complexConfig } from '../../../../../tests/fixtures/config.complex.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

const ALL = { status: 'ALL', riskOnly: false, descopedOnly: false, search: '' }

const states: { name: string; patch: Record<string, unknown> }[] = [
  { name: 'default', patch: {} },
  { name: 'status DEV', patch: { filter: { ...ALL, status: 'DEV' } } },
  { name: 'riskOnly', patch: { filter: { ...ALL, riskOnly: true } } },
]

const fixtures: { name: string; config: unknown }[] = []

beforeAll(() => {
  fixtures.push({ name: 'minimal', config: canonicalRoadmap(minimalConfig) })
  fixtures.push({ name: 'complex', config: canonicalRoadmap(complexConfig) })
})

const noop = () => {}

describe('LiteDashboard golden markup', () => {
  for (const fixtureName of ['minimal', 'complex']) {
    for (const state of states) {
      it(`${fixtureName} / ${state.name} equals Lite's renderDashboard`, async () => {
        const fixture = fixtures.find((f) => f.name === fixtureName)!
        const { roadmapModel, liteHtml } = await liteModelFor(fixture.config, state.patch)
        const { container } = render(
          <LiteDashboard
            model={buildDashboardModel(roadmapModel)}
            onStatusClick={noop}
            onRiskToggle={noop}
            onDescopedToggle={noop}
          />,
        )
        expect(normalizeMarkup(container.firstElementChild as Element)).toBe(normalizeHtmlString(liteHtml.dashboard))
      })
    }
  }
})

describe('LiteDashboard interactions', () => {
  it('calls onStatusClick with the state key of the clicked KPI card', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.find((f) => f.name === 'complex')!.config)
    const model = buildDashboardModel(roadmapModel)
    const onStatusClick = vi.fn()
    const { container } = render(
      <LiteDashboard model={model} onStatusClick={onStatusClick} onRiskToggle={noop} onDescopedToggle={noop} />,
    )
    const cards = container.querySelectorAll('.kpi-card.clickable')
    expect(cards.length).toBe(model.kpiCards.length)
    fireEvent.click(cards[0])
    expect(onStatusClick).toHaveBeenCalledWith(model.kpiCards[0].key)
  })

  it('gives clickable blocks button semantics and activates them with Enter and Space', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.find((f) => f.name === 'complex')!.config)
    const onStatusClick = vi.fn()
    const { container } = render(
      <LiteDashboard
        model={buildDashboardModel(roadmapModel)}
        onStatusClick={onStatusClick}
        onRiskToggle={noop}
        onDescopedToggle={noop}
      />,
    )
    const card = container.querySelector('.kpi-card.clickable') as HTMLElement
    expect(card.getAttribute('role')).toBe('button')
    expect(card.tabIndex).toBe(0)
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    fireEvent.keyDown(card, { key: 'a' })
    expect(onStatusClick).toHaveBeenCalledTimes(2)
  })

  it('toggles the risk and descoped filters from their summary blocks', async () => {
    const { roadmapModel } = await liteModelFor(fixtures.find((f) => f.name === 'complex')!.config)
    const onRiskToggle = vi.fn()
    const onDescopedToggle = vi.fn()
    const { container } = render(
      <LiteDashboard
        model={buildDashboardModel(roadmapModel)}
        onStatusClick={noop}
        onRiskToggle={onRiskToggle}
        onDescopedToggle={onDescopedToggle}
      />,
    )
    const risk = container.querySelector('.risk-summary.clickable')
    const descoped = container.querySelector('.descoped-summary.clickable')
    if (risk) fireEvent.click(risk)
    if (descoped) fireEvent.click(descoped)
    expect(onRiskToggle).toHaveBeenCalledTimes(risk ? 1 : 0)
    expect(onDescopedToggle).toHaveBeenCalledTimes(descoped ? 1 : 0)
    expect(risk || descoped).not.toBeNull()
  })
})
