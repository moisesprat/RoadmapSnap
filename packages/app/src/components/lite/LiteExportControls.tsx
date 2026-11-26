// React render of Lite's export buttons (js/ui/exportControls.js) with Lite's tag tree and class names (D-01), and
// the behavior of Lite's export handlers (D-12): CSV and JSON come from the core builders, PNG captures use
// html2canvas with Lite's options. The only raw HTML is the constant EXPORT_ICON_SVGS from @roadmapsnap/core.
import { useState } from 'react'
import html2canvas from 'html2canvas'
import { EXPORT_FILENAMES, EXPORT_ICON_SVGS, buildCsv, buildJson } from '@roadmapsnap/core'
import type { RoadmapConfig } from '@roadmapsnap/core'
import { downloadDataUrl, downloadText } from './download'

export interface LiteExportControlsProps {
  config: RoadmapConfig
  /** Today as DD/MM/YYYY, used for the CSV and JSON content and the PNG file names. */
  today: string
  /** Called with the error when a PNG capture fails, so the page can tell the user. */
  onExportError?: (err: unknown) => void
}

type IconKey = keyof typeof EXPORT_ICON_SVGS

interface ExportButtonProps {
  icon: IconKey
  label: string
  secondary?: boolean
  busy?: boolean
  onClick: () => void
}

// Lite puts the icon markup and the label straight into the button, so the button content is one constant string.
function ExportButton({ icon, label, secondary = true, busy = false, onClick }: ExportButtonProps) {
  return (
    <button
      className={secondary ? 'export-btn secondary' : 'export-btn'}
      disabled={busy}
      aria-busy={busy || undefined}
      style={busy ? { opacity: 0.6 } : undefined}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: EXPORT_ICON_SVGS[icon] + ' ' + label }}
    />
  )
}

export function LiteExportControls({ config, today, onExportError }: LiteExportControlsProps) {
  const [capturing, setCapturing] = useState(false)

  async function exportPng(elementId: string, prefix: string) {
    const element = document.getElementById(elementId)
    if (!element) {
      console.error('Export failed: element not found:', elementId)
      return
    }
    setCapturing(true)
    try {
      if (document.fonts) await document.fonts.ready
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      })
      downloadDataUrl(canvas.toDataURL('image/png'), `${prefix}-${today.replace(/\//g, '-')}.png`)
    } catch (err) {
      console.error('Export failed:', err)
      onExportError?.(err)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="export-controls">
      <ExportButton
        icon="full"
        label="Export Full Roadmap"
        secondary={false}
        busy={capturing}
        onClick={() => void exportPng('roadmap-export', 'Full-Roadmap')}
      />{' '}
      <ExportButton
        icon="summary"
        label="Export Summary Only"
        busy={capturing}
        onClick={() => void exportPng('summary-section', 'Summary-Dashboard')}
      />{' '}
      <ExportButton
        icon="timeline"
        label="Export Timeline Only"
        busy={capturing}
        onClick={() => void exportPng('timeline-section', 'Timeline-Only')}
      />{' '}
      <ExportButton
        icon="csv"
        label="CSV"
        onClick={() => downloadText(buildCsv(config, { today }), EXPORT_FILENAMES.csv, 'text/csv')}
      />{' '}
      <ExportButton
        icon="json"
        label="JSON"
        onClick={() =>
          downloadText(
            buildJson(config, { today, now: new Date().toISOString() }),
            EXPORT_FILENAMES.json,
            'application/json',
          )
        }
      />{' '}
      <span className="export-note">Export different views for your presentation</span>
    </div>
  )
}
