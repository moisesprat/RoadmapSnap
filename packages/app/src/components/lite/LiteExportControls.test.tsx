// Export controls and footers (D-01, D-12, VIEW-06): golden markup against Lite's renderers, and the download
// behavior Lite's export handlers have (CSV and JSON bytes from core, PNG capture with Lite's html2canvas options).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { buildCsv, buildJson } from '@roadmapsnap/core'
import html2canvas from 'html2canvas'
import { LiteExportControls } from './LiteExportControls'
import { LiteFooter } from './LiteFooter'
import { normalizeHtmlString, normalizeMarkup } from '../../test/goldenMarkup'
import { liteModelFor } from '../../test/liteRenderer'
// @ts-ignore Lite fixtures are plain JavaScript without declarations
import { minimalConfig } from '../../../../../tests/fixtures/config.minimal.js'
// @ts-ignore
import { complexConfig } from '../../../../../tests/fixtures/config.complex.js'
// @ts-ignore
import { canonicalRoadmap } from '../../../../../tests/helpers/roadmapToApi.js'

vi.mock('html2canvas', () => ({ default: vi.fn() }))

const TODAY = '15/04/2026'
const config = canonicalRoadmap(minimalConfig)

const fixtures: { name: string; config: any }[] = []
beforeAll(() => {
  fixtures.push({ name: 'minimal', config })
  fixtures.push({ name: 'complex', config: canonicalRoadmap(complexConfig) })
})

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('golden markup', () => {
  for (const name of ['minimal', 'complex']) {
    it(`${name}: LiteExportControls equals Lite's renderExportControls`, async () => {
      const fixture = fixtures.find((f) => f.name === name)!
      const { liteHtml } = await liteModelFor(fixture.config)
      const { container } = render(<LiteExportControls config={fixture.config} today={TODAY} />)
      expect(container.querySelector('.export-controls')).not.toBeNull()
      expect(normalizeMarkup(container.firstElementChild as Element)).toBe(normalizeHtmlString(liteHtml.exportControls))
    })
  }

  it("LiteFooter equals Lite's renderFooter apart from the version and build date text", async () => {
    const { liteHtml } = await liteModelFor(config)
    const { container } = render(<LiteFooter />)
    expect(container.querySelector('footer.page-footer')).not.toBeNull()
    // The version line legitimately differs between the products, so its text is excluded from the comparison.
    const withoutVersion = (markup: string) =>
      markup.replace(/(<footer class="build-version">)[^<]*(<\/footer>)/, '$1$2')
    const reactMarkup = Array.from(container.children).map((el) => normalizeMarkup(el)).join('')
    expect(withoutVersion(reactMarkup)).toBe(withoutVersion(normalizeHtmlString(liteHtml.footer)))
    expect(container.querySelector('.build-version')?.textContent).toMatch(/^v.+ · Build .+/)
  })
})

describe('downloads', () => {
  let blobs: Blob[]
  let clicks: { download: string; href: string }[]

  beforeEach(() => {
    blobs = []
    clicks = []
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        blobs.push(blob)
        return 'blob:parity-test'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('CSV downloads buildCsv output as deliverables.csv', async () => {
    render(<LiteExportControls config={config} today={TODAY} />)
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }))
    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe('deliverables.csv')
    expect(blobs[0].type).toBe('text/csv')
    expect(await readBlob(blobs[0])).toBe(buildCsv(config, { today: TODAY }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:parity-test')
  })

  it('JSON downloads buildJson output as deliverables.json', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'))
    render(<LiteExportControls config={config} today={TODAY} />)
    fireEvent.click(screen.getByRole('button', { name: /JSON/ }))
    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe('deliverables.json')
    expect(blobs[0].type).toBe('application/json')
    expect(await readBlob(blobs[0])).toBe(buildJson(config, { today: TODAY, now: '2026-04-15T12:00:00.000Z' }))
  })
})

describe('PNG export', () => {
  const capture = html2canvas as unknown as ReturnType<typeof vi.fn>
  let clicks: { download: string; href: string }[]

  function renderPage(props: Partial<React.ComponentProps<typeof LiteExportControls>> = {}) {
    return render(
      <div>
        <LiteExportControls config={config} today={TODAY} {...props} />
        <div id="roadmap-export" />
        <div id="summary-section" />
        <div id="timeline-section" />
      </div>,
    )
  }

  beforeEach(() => {
    clicks = []
    capture.mockReset()
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("captures #roadmap-export with Lite's html2canvas options and downloads Full-Roadmap-15-04-2026.png", async () => {
    capture.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,AAAA' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Export Full Roadmap/ }))
    await waitFor(() => expect(clicks).toHaveLength(1))
    expect(capture).toHaveBeenCalledWith(document.getElementById('roadmap-export'), {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    })
    expect(clicks[0].download).toBe('Full-Roadmap-15-04-2026.png')
    expect(clicks[0].href).toBe('data:image/png;base64,AAAA')
  })

  it('names the summary and timeline captures like Lite', async () => {
    capture.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,AAAA' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Export Summary Only/ }))
    await waitFor(() => expect(clicks).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /Export Timeline Only/ }))
    await waitFor(() => expect(clicks).toHaveLength(2))
    expect(capture.mock.calls[0][0]).toBe(document.getElementById('summary-section'))
    expect(capture.mock.calls[1][0]).toBe(document.getElementById('timeline-section'))
    expect(clicks.map((c) => c.download)).toEqual(['Summary-Dashboard-15-04-2026.png', 'Timeline-Only-15-04-2026.png'])
  })

  it('disables the PNG buttons with aria-busy during a capture and keeps their labels', async () => {
    let finish: (canvas: { toDataURL: () => string }) => void = () => {}
    capture.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderPage()
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    fireEvent.click(screen.getByRole('button', { name: /Export Full Roadmap/ }))
    await waitFor(() => expect(capture).toHaveBeenCalled())
    const pngButtons = [/Export Full Roadmap/, /Export Summary Only/, /Export Timeline Only/].map((name) =>
      screen.getByRole('button', { name }),
    )
    for (const button of pngButtons) {
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
    }
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(labels)
    await act(async () => finish({ toDataURL: () => 'data:image/png;base64,AAAA' }))
    for (const button of pngButtons) {
      expect(button).toBeEnabled()
      expect(button).not.toHaveAttribute('aria-busy', 'true')
    }
  })

  it('reports a rejected capture with console.error and onExportError, then re-enables the buttons', async () => {
    const failure = new Error('canvas failed')
    capture.mockRejectedValue(failure)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onExportError = vi.fn()
    renderPage({ onExportError })
    fireEvent.click(screen.getByRole('button', { name: /Export Full Roadmap/ }))
    await waitFor(() => expect(onExportError).toHaveBeenCalledWith(failure))
    expect(consoleError).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Export Full Roadmap/ })).toBeEnabled()
    expect(clicks).toHaveLength(0)
  })
})
