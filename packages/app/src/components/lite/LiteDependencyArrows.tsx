// RED stub (02-13): replaced by the real component in the GREEN commit.
import type { Deliverable, Month, WorkflowItem } from '@roadmapsnap/core'

export interface LiteDependencyArrowsProps {
  graphName: string | null
  riskOnly: boolean
  deliverables: Deliverable[]
  workflow: WorkflowItem[]
  today: string
  months: Month[]
  layoutKey: string
  onCloseGraph: () => void
  onClearStatusFilters: () => void
}

export function LiteDependencyArrows(_props: LiteDependencyArrowsProps) {
  return null
}
