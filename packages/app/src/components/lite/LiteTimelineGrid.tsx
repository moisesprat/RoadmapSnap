// React render of core's TimelineModel with the tag tree and class names of Lite's renderTimelineGrid
// (js/ui/timelineGrid.js), so the shared tokens CSS styles both the same way (D-01). Every tenant string is a JSX
// text node or attribute (titles keep their newline characters); the only raw HTML is the core INFO_ICON_SVG and
// RISK_ICON_SVG constants. The chevron and dependency icons are JSX svg elements, not strings.
import type { KeyboardEvent, MouseEvent } from 'react'
import { INFO_ICON_SVG, RISK_ICON_SVG } from '@roadmapsnap/core'
import type { TimelineModel, TimelineRow } from '@roadmapsnap/core'

type Activation = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>

export interface LiteTimelineGridProps {
  model: TimelineModel
  onToggleGroup: (groupName: string) => void
  onToggleGraph: (deliverableName: string) => void
}

function classes(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

// Lite wires these with onclick; the SaaS render adds button semantics and Enter/Space activation.
function activatable(handler: (event: Activation) => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (event: Activation) => handler(event),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      handler(event)
    },
  }
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={classes('group-chevron', collapsed && 'collapsed')}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function DependencyIcon({ type }: { type: 'inbound' | 'outbound' | 'both' }) {
  if (type === 'inbound') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.5 3v7H6l6 8 6-8h-3.5V3z" />
      </svg>
    )
  }
  if (type === 'outbound') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.5 21v-7H18l-6-8-6 8h3.5v7z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
    </svg>
  )
}

interface RowProps {
  row: TimelineRow
  model: TimelineModel
  onToggleGraph: (deliverableName: string) => void
}

function SourceRow({ row, model, onToggleGraph }: RowProps) {
  const todayStyle = { left: `${model.todayPosition}%` }
  const dependency = row.dependency
  return (
    <div
      className={classes(
        'data-source-row',
        row.atRisk && 'at-risk',
        row.groupItem && 'group-item',
        row.dependencyClass,
        row.descoped && 'descoped',
      )}
    >
      <div className={classes('source-name', `state-${row.stateIndex}`)}>
        {row.atRisk && (
          <div className="risk-indicator" title="At Risk" dangerouslySetInnerHTML={{ __html: RISK_ICON_SVG }} />
        )}
        <span className="source-name-text">{row.name}</span>{' '}
        {row.safeLink && (
          <>
            <a
              className="info-link"
              href={row.safeLink}
              target="_blank"
              rel="noopener noreferrer"
              title="More info"
              dangerouslySetInnerHTML={{ __html: INFO_ICON_SVG }}
            />{' '}
          </>
        )}
        {dependency && (
          <div
            className={classes('dependency-icon', dependency.type, dependency.active && 'active')}
            title={dependency.tooltip}
            aria-label={dependency.tooltip}
            {...activatable((event) => {
              event.stopPropagation()
              onToggleGraph(row.name)
            })}
          >
            <DependencyIcon type={dependency.type} />
          </div>
        )}
        <span className={classes('status-indicator', `state-${row.stateIndex}`)} title={row.status.title}>
          {row.status.short}
        </span>
      </div>
      <div className="timeline-track">
        {model.gridLines.map((leftPct, index) => (
          <div key={index} className="month-grid-line" style={{ left: `${leftPct}%` }} />
        ))}
        {model.showGantt
          ? row.segments.map((segment, index) => (
              <div
                key={index}
                className={classes('gantt-bar', segment.segmentClass, segment.isFuture && 'gantt-future')}
                style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                title={row.ganttTooltip}
              />
            ))
          : row.ganttTooltip && <div className="gantt-tooltip-overlay" title={row.ganttTooltip} />}
        <div className="today-guide-line" style={todayStyle} />
        {row.markers.map((marker, index) => (
          <div
            key={index}
            className={classes('milestone-marker', marker.slotClass)}
            style={
              marker.hideLabel
                ? {
                    left: `${marker.position}%`,
                    minWidth: '8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                  }
                : { left: `${marker.position}%` }
            }
          >
            {!marker.hideLabel && (
              <>
                <span>{marker.short}</span>
                <div className="milestone-date">{marker.dateText}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LiteTimelineGrid({ model, onToggleGroup, onToggleGraph }: LiteTimelineGridProps) {
  const todayStyle = { left: `${model.todayPosition}%` }
  return (
    <div id="timeline-section">
      <div className="state-legend">
        <div className="state-legend-items">
          {model.legend.map((item, index) => (
            <div key={index} className="state-legend-item">
              <span className={classes('state-legend-badge', item.stateClass)}>{item.short}</span>{' '}
              <span className="state-legend-label">{item.title}</span>
            </div>
          ))}
        </div>
        <div className="state-legend-info">
          Timeline: <span className="state-legend-info-count">{model.rangeStart}</span> -{' '}
          <span className="state-legend-info-count">{model.rangeEnd}</span>
        </div>
      </div>
      <div className="roadmap-content">
        <div className="roadmap-grid">
          <div className="timeline-header">
            <div className="timeline-label">{model.columnHeader}</div>
            <div className="timeline-months">
              {model.headerPeriods.map((period, index) => (
                <div
                  key={index}
                  className="month-column"
                  style={{ width: `${period.widthPct}%`, flex: `0 0 ${period.widthPct}%` }}
                >
                  {period.label}
                </div>
              ))}
              <div className="today-pointer" style={todayStyle}>
                <div className="today-pointer-arrow" />
              </div>
            </div>
          </div>
          {model.sections.map((section, sectionIndex) => {
            if (section.kind !== 'group') {
              return section.rows.map((row, index) => (
                <SourceRow key={`u${sectionIndex}:${index}`} row={row} model={model} onToggleGraph={onToggleGraph} />
              ))
            }
            return [
              <div
                key={`g${sectionIndex}`}
                className="group-header"
                aria-expanded={!section.collapsed}
                {...activatable(() => onToggleGroup(section.name))}
              >
                <div className="group-header-name">
                  <Chevron collapsed={section.collapsed} /> {section.name}{' '}
                  <span className="group-stats">
                    {section.stats.count} items
                    {section.stats.atRisk > 0 && (
                      <>
                        {' '}
                        <span className="group-stats-risk">({section.stats.atRisk} at risk)</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="group-header-track" />
              </div>,
              ...(section.collapsed
                ? []
                : section.rows.map((row, index) => (
                    <SourceRow
                      key={`g${sectionIndex}:${index}`}
                      row={row}
                      model={model}
                      onToggleGraph={onToggleGraph}
                    />
                  ))),
            ]
          })}
        </div>
      </div>
    </div>
  )
}
