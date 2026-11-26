// Dependency-arrow overlay for the React Lite view (VIEW-03). It measures the rows Lite measures (the container,
// each .data-source-row and its .timeline-track) after the commit, hands the rectangles to core
// computeDependencyArrows, and renders the SVG Lite's drawDependencyArrows builds (js/ui/dependencyArrows.js),
// through a portal into .roadmap-content. Geometry, arrowhead, color and title text all come from core; titles
// and path data are JSX attributes and text, never markup. Also owns the two document click rules of Lite
// (outside a graph closes it, outside the status controls clears the status filters).
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ARROW_MARKERS,
  ARROW_STROKE,
  GRAPH_OUTSIDE_CLICK_EXCLUSIONS,
  STATUS_OUTSIDE_CLICK_EXCLUSIONS,
  computeDependencyArrows,
  getDependencyGraph,
} from '@roadmapsnap/core'
import type { Arrow, ArrowRects, Deliverable, Month, RowRect, WorkflowItem } from '@roadmapsnap/core'
import { useDocumentClick } from '../../hooks/useDocumentClick'

export interface LiteDependencyArrowsProps {
  /** The deliverable whose dependency graph is open, or null. */
  graphName: string | null
  /** With no graph open, riskOnly shows the blocked arrows alone. */
  riskOnly: boolean
  deliverables: Deliverable[]
  workflow: WorkflowItem[]
  /** DD/MM/YYYY */
  today: string
  /** The months the timeline shows (TimelineModel.months), so positions match the Gantt. */
  months: Month[]
  /** Changes whenever the rows move without a prop above changing (zoom, sort, filter, collapsed groups). */
  layoutKey: string
  onCloseGraph: () => void
  onClearStatusFilters: () => void
}

interface Overlay {
  container: HTMLElement
  arrows: Arrow[]
}

// Same measuring as Lite: rows are keyed by name (a name seen twice keeps the first row); rows of collapsed
// groups are not in the DOM, so they have no entry and their edges are skipped by core.
function measureArrowRects(container: HTMLElement): ArrowRects {
  const containerRect = container.getBoundingClientRect()
  const rows: Record<string, RowRect> = Object.create(null)
  container.querySelectorAll('.data-source-row').forEach((row) => {
    const nameEl = row.querySelector('.source-name-text')
    if (!nameEl) return
    const name = (nameEl.textContent || '').trim()
    if (name in rows) return
    const rect = row.getBoundingClientRect()
    const track = row.querySelector('.timeline-track')
    const trackRect = track ? track.getBoundingClientRect() : rect
    rows[name] = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      trackLeft: trackRect.left,
      trackWidth: trackRect.width,
    }
  })
  return { container: { left: containerRect.left, top: containerRect.top }, rows }
}

function sameArrows(a: Arrow[], b: Arrow[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function LiteDependencyArrows({
  graphName,
  riskOnly,
  deliverables,
  workflow,
  today,
  months,
  layoutKey,
  onCloseGraph,
  onClearStatusFilters,
}: LiteDependencyArrowsProps) {
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [resizeTick, setResizeTick] = useState(0)
  const onlyRed = riskOnly && !graphName
  const active = !!graphName || onlyRed

  useLayoutEffect(() => {
    const container = active ? document.querySelector<HTMLElement>('.roadmap-content') : null
    if (!container) {
      setOverlay(null)
      return
    }
    const arrows = computeDependencyArrows({
      graph: graphName ? getDependencyGraph(graphName, deliverables) : null,
      deliverables,
      workflow,
      today,
      months,
      rects: measureArrowRects(container),
      onlyRed,
    })
    container.style.position = 'relative'
    setOverlay((previous) =>
      previous && previous.container === container && sameArrows(previous.arrows, arrows)
        ? previous
        : { container, arrows },
    )
    return () => {
      container.style.position = ''
    }
  }, [active, graphName, onlyRed, deliverables, workflow, today, months, layoutKey, resizeTick])

  useLayoutEffect(() => {
    const onResize = () => setResizeTick((tick) => tick + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Two listeners, registered in Lite's order (status filters first, then the graph).
  useDocumentClick((event) => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    if (!target.closest(STATUS_OUTSIDE_CLICK_EXCLUSIONS)) onClearStatusFilters()
  })
  useDocumentClick((event) => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    if (graphName && !target.closest(GRAPH_OUTSIDE_CLICK_EXCLUSIONS)) onCloseGraph()
  })

  if (!active || !overlay) return null

  return createPortal(
    <svg
      id="dependency-arrows-svg"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20 }}
      pointerEvents="none"
    >
      <defs>
        {ARROW_MARKERS.map(({ id, color }) => (
          <marker key={id} id={id} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={color} stroke={color} strokeWidth="1" />
          </marker>
        ))}
      </defs>
      {overlay.arrows.map((arrow) => {
        const stroke = hovered === arrow.id ? ARROW_STROKE.hover : ARROW_STROKE.normal
        return (
          <g
            key={arrow.id}
            style={{ cursor: 'pointer' }}
            pointerEvents="auto"
            onMouseEnter={() => setHovered(arrow.id)}
            onMouseLeave={() => setHovered((current) => (current === arrow.id ? null : current))}
          >
            <path d={arrow.d} stroke="transparent" strokeWidth="14" fill="none" pointerEvents="stroke" />
            <path
              d={arrow.d}
              className={`dependency-arrow-${arrow.type}`}
              stroke={arrow.color}
              style={{ stroke: arrow.color }}
              strokeWidth={String(stroke.width)}
              fill="none"
              markerEnd={`url(#${arrow.markerId})`}
              opacity={String(stroke.opacity)}
              pointerEvents="none"
            />
            <title>{arrow.title}</title>
          </g>
        )
      })}
    </svg>,
    overlay.container,
  )
}
