// Export buttons of the Lite page (CSV, JSON, three PNG captures).
import type { RoadmapConfig } from '@roadmapsnap/core'

export interface LiteExportControlsProps {
  config: RoadmapConfig
  /** Today as DD/MM/YYYY, used for the CSV and JSON content and the PNG file names. */
  today: string
  onExportError?: (err: unknown) => void
}

export function LiteExportControls(_props: LiteExportControlsProps) {
  return null
}
