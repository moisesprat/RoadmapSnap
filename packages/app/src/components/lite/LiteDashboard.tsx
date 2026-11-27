// React render of core's DashboardModel with the tag tree and class names of Lite's renderDashboard
// (js/ui/dashboard.js), so the shared tokens CSS styles both the same way (D-01). Every tenant string is a JSX
// text node or attribute; the only raw HTML is the constant RISK_ICON_SVG from @roadmapsnap/core.
import type { KeyboardEvent, MouseEvent } from 'react'
import { RISK_ICON_SVG } from '@roadmapsnap/core'
import type { DashboardModel } from '@roadmapsnap/core'

type Activation = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>

export interface LiteDashboardProps {
  model: DashboardModel
  onStatusClick: (statusKey: string) => void
  onRiskToggle: () => void
  onDescopedToggle: () => void
}

function classes(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

// Lite wires these blocks with onclick; the SaaS render adds button semantics and Enter/Space activation.
// Like Lite's handlers, activation does not bubble to the document-level outside-click handler.
function activatable(handler: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (event: Activation) => {
      event.stopPropagation()
      handler()
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      handler()
    },
  }
}

export function LiteDashboard({ model, onStatusClick, onRiskToggle, onDescopedToggle }: LiteDashboardProps) {
  const { riskSummary, descopedSummary, totalCard } = model
  return (
    <div className="summary-dashboard" id="summary-section">
      <div className="summary-header">
        <div className="summary-title">
          {model.title}{' '}
          <span className="summary-title-note">
            ({model.total} total {model.scopeLabel}, {model.visible} shown in timeline)
          </span>
        </div>
        <div className="header-right">
          {riskSummary && !riskSummary.disabled && (
            <div
              className={classes('risk-summary', 'clickable', riskSummary.active && 'active')}
              title="Click to filter At Risk items"
              {...activatable(onRiskToggle)}
            >
              <span className="risk-summary-icon" dangerouslySetInnerHTML={{ __html: RISK_ICON_SVG }} />{' '}
              <span className="risk-summary-text">{riskSummary.count} At Risk</span>
            </div>
          )}
          {riskSummary && riskSummary.disabled && (
            <div className="risk-summary disabled" title="No at-risk items in current filter">
              <span className="risk-summary-icon" dangerouslySetInnerHTML={{ __html: RISK_ICON_SVG }} />{' '}
              <span className="risk-summary-text">0 At Risk</span>
            </div>
          )}
          {descopedSummary && (
            <div
              className={classes('descoped-summary', 'clickable', descopedSummary.active && 'active')}
              title="Click to filter Descoped items"
              {...activatable(onDescopedToggle)}
            >
              <span className="descoped-summary-text">{descopedSummary.count} Descoped</span>
            </div>
          )}
          <div className="today-date-container">
            <span className="today-date-label">Today:</span>{' '}
            <span className="today-date-value">{model.todayLabel}</span>
          </div>
        </div>
      </div>
      <div className="kpi-section" style={{ gridTemplateColumns: `repeat(${model.kpiColumns}, 1fr)` }}>
        <div className="kpi-card total">
          <div className="kpi-value">{totalCard.value}</div>
          <div className="kpi-label">{totalCard.label}</div>
          <div className="kpi-sublabel">{totalCard.sublabel}</div>
          {totalCard.breakdownText && <div className="kpi-breakdown">{totalCard.breakdownText}</div>}
        </div>
        {model.kpiCards.map((card) => (
          <div
            key={card.key}
            className={classes('kpi-card', 'clickable', card.stateClass, card.active && 'active')}
            {...activatable(() => onStatusClick(card.key))}
          >
            <div className="kpi-value">{card.count}</div>
            <div className="kpi-label">{card.title}</div>
            <div className="kpi-sublabel">{card.description}</div>
            {card.breakdownText && <div className="kpi-breakdown">{card.breakdownText}</div>}
          </div>
        ))}
      </div>
      <div className="progress-section">
        <div className="progress-header">
          <div className="progress-title">{model.progress.title}</div>
        </div>
        <div className="progress-bar-container">
          {model.progress.segments.map((segment) => (
            <div
              key={segment.key}
              className={classes('progress-segment', segment.stateClass)}
              style={{ width: `${segment.widthPct}%`, opacity: segment.opacity }}
            >
              {segment.label}
            </div>
          ))}
        </div>
        <div className="progress-legend">
          {model.legend.map((item) => (
            <div key={item.key} className="progress-legend-item">
              <div className={classes('progress-legend-dot', item.stateClass)}></div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="key-milestones" style={{ gridTemplateColumns: `repeat(${model.milestoneColumns}, 1fr)` }}>
        {model.milestoneCards.map((card) => (
          <div key={card.key} className="milestone-card">
            <div className="milestone-card-header">
              <div className={classes('milestone-card-icon', card.slot)}>{card.short}</div>
              <div>
                <div className="milestone-card-title">Next {card.title}</div>
                <div className="milestone-card-subtitle">{card.subtitle}</div>
              </div>
            </div>
            <div className="milestone-card-content">
              {card.nextName != null ? (
                <>
                  <span className="milestone-card-date">{card.nextDate}</span>
                  {' - '}
                  <span className="milestone-card-source">{card.nextName}</span>
                  {card.atRisk ? ' ⚠️' : ''}
                </>
              ) : (
                card.completeText
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
