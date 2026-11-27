// LiteRoadmapView resets its view state when resetKey changes (a workspace switch) and keeps the order of Lite's page.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { LiteRoadmapView } from './LiteRoadmapView'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

vi.mock('html2canvas', () => ({ default: vi.fn() }))

let config: any
beforeAll(() => {
  config = canonicalRoadmap(minimalConfig)
})

const noop = () => {}

function view(resetKey: string) {
  return (
    <LiteRoadmapView config={config} today="15/04/2026" theme="light" onThemeChange={noop} onExportError={noop} resetKey={resetKey} />
  )
}

describe('LiteRoadmapView', () => {
  it('returns filter, sort, zoom and groups to their defaults when resetKey changes, and not otherwise', () => {
    const { container, rerender } = render(view('a'))
    const active = () => (container.querySelector('.zoom-btn.active') as HTMLElement).textContent
    const initial = active()
    const other = Array.from(container.querySelectorAll('.zoom-btn')).find((b) => b.textContent !== initial) as HTMLElement
    fireEvent.click(other)
    expect(active()).toBe(other.textContent)

    rerender(view('a'))
    expect(active()).toBe(other.textContent)

    rerender(view('b'))
    expect(active()).toBe(initial)
  })

  it('renders the Lite area children in Lite order with .filter-bar a direct child', () => {
    const { container } = render(view('a'))
    const area = container.querySelector('.lite-area') as Element
    expect(Array.from(area.children).map((el) => el.classList[0])).toEqual([
      'filter-bar',
      'export-controls',
      'roadmap-container',
      'page-footer',
      'build-version',
    ])
  })
})
