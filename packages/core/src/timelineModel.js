/**
 * RoadmapSnap core: timeline grid model.
 * Every decision Lite's timeline grid and grouping modules made (header periods, grid lines, group sections and
 * their order, per-row classes, Gantt segments, milestone markers, tooltip texts, status text, dependency icon
 * and tooltip, risk flag, safe link) lives here, so Lite (HTML strings) and the SaaS app (React) are mappers over
 * the same model. Models carry plain strings, numbers, booleans and arrays, never markup built from deliverable
 * data. Pure: no DOM, no storage, no clock.
 */

import { formatDateDisplay } from './dates.js';
import { getTimelineHeaderPeriods } from './timeline.js';
import {
    getStates, getMilestones, getFirstMilestoneKey, getLastMilestoneKey, getMilestoneByKey, getMilestoneDate,
} from './workflow.js';
import { buildDeliverableViewModel } from './viewModel.js';
import { safeHttpUrl } from './markup.js';

/**
 * @typedef {{ nodes: string[], inboundEdges: any[], outboundEdges: any[] }} TimelineGraph
 * @typedef {{
 *   name: string,
 *   groupItem: boolean,
 *   stateIndex: number,
 *   atRisk: boolean,
 *   descoped: boolean,
 *   dependencyClass: string,
 *   status: { short: string, title: string },
 *   segments: { left: number, width: number, segmentClass: string, isFuture: boolean }[],
 *   markers: { position: number, slotClass: string, short: string, date: string, dateText: string, hideLabel: boolean }[],
 *   ganttTooltip: string,
 *   dependency: { type: 'inbound' | 'outbound' | 'both', active: boolean, tooltip: string } | null,
 *   link: string | null,
 *   safeLink: string | null
 * }} TimelineRow
 * @typedef {{ kind: 'group', name: string, collapsed: boolean, stats: { count: number, atRisk: number }, rows: TimelineRow[] }} TimelineGroupSection
 * @typedef {{ kind: 'ungrouped', rows: TimelineRow[] }} TimelineUngroupedSection
 * @typedef {{
 *   columnHeader: string,
 *   headerPeriods: ReturnType<typeof getTimelineHeaderPeriods>,
 *   months: import('./timeline.js').Month[],
 *   gridLines: number[],
 *   todayPosition: number | null,
 *   showGantt: boolean,
 *   legend: { stateClass: string, short: string, title: string }[],
 *   rangeStart: string,
 *   rangeEnd: string,
 *   sections: (TimelineGroupSection | TimelineUngroupedSection)[]
 * }} TimelineModel
 */

/**
 * Splits deliverables into groups (by group name) and ungrouped ones, keeping their order.
 * @param {import('./workflow.js').Deliverable[]} sources
 * @returns {{ groups: Record<string, import('./workflow.js').Deliverable[]>, ungrouped: import('./workflow.js').Deliverable[] }}
 */
export function groupDeliverables(sources) {
    /** @type {Record<string, import('./workflow.js').Deliverable[]>} */
    const groups = {};
    /** @type {import('./workflow.js').Deliverable[]} */
    const ungrouped = [];

    sources.forEach(source => {
        const groupName = source.group || null;
        if (groupName) {
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(source);
        } else {
            ungrouped.push(source);
        }
    });

    return { groups, ungrouped };
}

/**
 * @param {import('./workflow.js').Deliverable[]} sources
 * @returns {boolean}
 */
export function hasAnyGroups(sources) {
    return sources.some(source => source.group);
}

/**
 * Item count and the count of rows flagged atRisk in the config (not the effective, dependency-derived set).
 * @param {import('./workflow.js').Deliverable[]} sources
 * @returns {{ total: number, atRisk: number }}
 */
export function getGroupStats(sources) {
    const atRiskCount = sources.filter(s => s.atRisk).length;
    return {
        total: sources.length,
        atRisk: atRiskCount
    };
}

/**
 * The groups of the deliverables named in a dependency graph (each group once, in deliverable order). Opening a
 * graph expands exactly these groups.
 * @param {string[]} nodes
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {string[]}
 */
export function groupNamesForNodes(nodes, deliverables) {
    /** @type {string[]} */
    const names = [];
    deliverables.forEach(source => {
        if (source.group && nodes.includes(source.name) && !names.includes(source.group)) {
            names.push(source.group);
        }
    });
    return names;
}

/**
 * The names of every group of the deliverables, each once, in deliverable order.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {string[]}
 */
function allGroupNames(deliverables) {
    /** @type {string[]} */
    const names = [];
    deliverables.forEach(source => {
        if (source.group && !names.includes(source.group)) names.push(source.group);
    });
    return names;
}

/**
 * Group names in display order: the config's GROUP_ORDER first (groups missing from it after, alphabetically),
 * or plain alphabetical order when the config has no GROUP_ORDER.
 * @param {string[]} names
 * @param {string[] | null} groupOrder
 * @returns {string[]}
 */
function orderGroupNames(names, groupOrder) {
    if (!groupOrder) return names.slice().sort();
    return names.slice().sort((a, b) => {
        const i = groupOrder.indexOf(a);
        const j = groupOrder.indexOf(b);
        if (i === -1 && j === -1) return a.localeCompare(b);
        if (i === -1) return 1;
        if (j === -1) return -1;
        return i - j;
    });
}

/**
 * Every group of the deliverables, for the expand-all and collapse-all transitions.
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {string[]}
 */
export function groupNamesOf(deliverables) {
    return allGroupNames(deliverables);
}

/**
 * The tooltip line of one dependency: "{task} ({from short} -> {to short}) - {date of the from-milestone}".
 * The from-milestone date is read from the blocker for inbound dependencies and from the deliverable itself
 * for outbound ones.
 * @param {{ task: string, from: string | null, to: string | null }} dep
 * @param {import('./workflow.js').Deliverable | undefined} dateSource the deliverable whose from-milestone date is shown
 * @param {import('./workflow.js').WorkflowItem[]} workflow
 * @returns {string}
 */
function formatDependency(dep, dateSource, workflow) {
    const firstKey = getFirstMilestoneKey(workflow);
    const fromKey = dep.from || getLastMilestoneKey(workflow);
    const toKey = dep.to || firstKey;
    const fromDef = getMilestoneByKey(workflow, fromKey);
    const toDef = getMilestoneByKey(workflow, toKey);
    const fromShort = (fromDef && fromDef.short) ? fromDef.short : fromKey;
    const toShort = (toDef && toDef.short) ? toDef.short : toKey;
    const fromDateStr = dateSource ? getMilestoneDate(dateSource, fromKey, firstKey) : null;
    const datePart = fromDateStr ? ' — ' + formatDateDisplay(fromDateStr) : '';
    return dep.task + ' (' + fromShort + ' → ' + toShort + ')' + datePart;
}

/**
 * The row of one deliverable.
 * @param {import('./workflow.js').Deliverable} source
 * @param {boolean} groupItem
 * @param {Omit<import('./models.js').RoadmapModel, 'timeline'>} roadmapModel
 * @param {import('./workflow.js').Deliverable[]} deliverables
 * @returns {TimelineRow}
 */
function buildRow(source, groupItem, roadmapModel, deliverables) {
    const { state, workflow, months, todayPosition, effectiveAtRiskSet, today, theme } = roadmapModel;
    const statesDef = getStates(workflow);
    const milestonesDef = getMilestones(workflow);
    const firstKey = getFirstMilestoneKey(workflow);
    const vm = buildDeliverableViewModel(source, {
        months,
        todayPosition: /** @type {number} */ (todayPosition),
        activeDependencyGraph: state.activeDependencyGraph,
        effectiveAtRiskSet,
        workflow,
        deliverables,
        today,
        theme,
    });
    const stateIndex = Math.min(7, Math.max(0, statesDef.findIndex(s => s.key === vm.status)));

    const ganttTooltipLines = milestonesDef.map(m => {
        const date = getMilestoneDate(source, m.key, firstKey);
        return date ? (m.short || m.key) + ': ' + formatDateDisplay(date) : null;
    }).filter(Boolean);

    /** @type {TimelineRow['dependency']} */
    let dependency = null;
    if (vm.dependencyType !== 'none') {
        const inbound = vm.inboundDeps.map(dep => formatDependency(dep, deliverables.find(s => s.name === dep.task), workflow));
        const outbound = vm.outboundDeps.map(dep => formatDependency(dep, source, workflow));
        let tooltip;
        if (vm.dependencyType === 'inbound') {
            tooltip = 'Blocked by:\n' + inbound.join('\n');
        } else if (vm.dependencyType === 'outbound') {
            tooltip = 'Blocks:\n' + outbound.join('\n');
        } else {
            tooltip = 'Blocked by:\n' + inbound.join('\n') + '\n\nBlocks:\n' + outbound.join('\n');
        }
        dependency = {
            type: /** @type {'inbound' | 'outbound' | 'both'} */ (vm.dependencyType),
            active: state.activeDependencyGraph === vm.name,
            tooltip,
        };
    }

    return {
        name: vm.name,
        groupItem,
        stateIndex,
        atRisk: vm.atRisk,
        descoped: vm.descoped,
        dependencyClass: vm.dependencyClass,
        status: {
            short: (vm.state && vm.state.short) || vm.status,
            title: (vm.state && vm.state.title) || vm.status,
        },
        segments: vm.ganttSegments,
        markers: vm.milestoneMarkers.map(m => ({ ...m, dateText: formatDateDisplay(m.date) })),
        ganttTooltip: ganttTooltipLines.length ? ganttTooltipLines.join('\n') : '',
        dependency,
        link: vm.link,
        safeLink: safeHttpUrl(vm.link),
    };
}

/**
 * The timeline grid model: header, month columns, grid lines, today pointer and the sections of rows. With
 * groups, the group sections come first (GROUP_ORDER, then alphabetical) and ungrouped rows after all of them;
 * without any group there is one ungrouped section. Rows of collapsed groups are still in the model (the
 * section carries the collapsed flag), so a mapper decides whether to show them.
 * @param {Omit<import('./models.js').RoadmapModel, 'timeline'>} roadmapModel
 * @returns {TimelineModel}
 */
export function buildTimelineModel(roadmapModel) {
    const { config, state, workflow, months, todayPosition, visibleSources } = roadmapModel;
    const deliverables = config.DELIVERABLES || [];
    const labels = config.ENTITY_LABELS;
    const totalDays = months.length ? months.reduce((s, m) => s + m.daysInMonth, 0) : 0;
    const gridLines = months.slice(1).map((_m, i) => {
        const cumDays = months.slice(0, i + 1).reduce((s, mo) => s + mo.daysInMonth, 0);
        return totalDays ? (cumDays / totalDays) * 100 : 0;
    });

    /** @type {TimelineModel['sections']} */
    const sections = [];
    if (hasAnyGroups(visibleSources)) {
        const { groups, ungrouped } = groupDeliverables(visibleSources);
        const groupOrder = (Array.isArray(config.GROUP_ORDER) && config.GROUP_ORDER.length) ? config.GROUP_ORDER : null;
        orderGroupNames(Object.keys(groups), groupOrder).forEach(name => {
            const groupSources = groups[name];
            const stats = getGroupStats(groupSources);
            sections.push({
                kind: 'group',
                name,
                collapsed: (state.groupCollapsed && state.groupCollapsed[name]) || false,
                stats: { count: stats.total, atRisk: stats.atRisk },
                rows: groupSources.map(s => buildRow(s, true, roadmapModel, deliverables)),
            });
        });
        sections.push({ kind: 'ungrouped', rows: ungrouped.map(s => buildRow(s, false, roadmapModel, deliverables)) });
    } else {
        sections.push({ kind: 'ungrouped', rows: visibleSources.map(s => buildRow(s, false, roadmapModel, deliverables)) });
    }

    return {
        columnHeader: (labels && (labels.columnHeader || labels.singular)) ? (labels.columnHeader || labels.singular) : 'Item',
        headerPeriods: getTimelineHeaderPeriods(months),
        months,
        gridLines,
        todayPosition,
        showGantt: state.showGantt,
        legend: getStates(workflow).map((s, i) => ({ stateClass: 'state-' + Math.min(i, 7), short: s.short, title: s.title })),
        rangeStart: months[0] ? months[0].name : '',
        rangeEnd: months[months.length - 1] ? months[months.length - 1].name : '',
        sections,
    };
}
