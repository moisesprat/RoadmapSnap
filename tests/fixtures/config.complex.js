// Synthetic parity fixture: every name, date and link is invented for tests. Keys follow the canonical
// adapter order (name, atRisk, descoped, showInTimeline, group, tags, link, milestones, dependencies).
// TODAY is 15/04/2026, so the dependency edges below resolve to:
//   red    Event Bus M3 (30/06/2026) is after Admin Portal START (01/05/2026)
//   orange Data Lake M1 (25/04/2026) is unfinished and 7 days before Mobile App M2 (02/05/2026)
//   green  Identity Service M3 / API Gateway M2 are already reached
// A "row with no milestone dates" uses START: '' because validateConfig requires the first milestone
// key on every deliverable (an empty {} would be a validation error).

export const complexWorkflow = [
  { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: 'Waiting for kickoff' },
  { type: 'milestone', key: 'START', short: 'GO', title: 'Start', subtitle: 'Kickoff' },
  { type: 'state', key: 'DSN', short: 'DSN', title: 'Design', description: 'Scoping and design' },
  { type: 'milestone', key: 'M1', short: 'M1', title: 'Design Complete', subtitle: 'Design sign-off' },
  { type: 'state', key: 'DEV', short: 'DEV', title: 'In Development and Cross-Team Integration Testing', description: 'Build and integrate' },
  { type: 'milestone', key: 'M2', short: 'M2', title: 'Feature Complete', subtitle: 'Code freeze' },
  { type: 'state', key: 'QA', short: 'QA', title: 'Quality Assurance', description: 'Verification' },
  { type: 'milestone', key: 'M3', short: 'M3', title: 'Release', subtitle: 'Go live' },
  { type: 'state', key: 'LIVE', short: 'LIVE', title: 'Live', description: 'In production' },
];

export const complexDeliverables = [
  {
    name: 'Identity Service',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Platform',
    tags: ['core', 'security'],
    link: 'https://example.com/identity',
    milestones: { START: '10/01/2025', M1: '15/03/2025', M2: '20/06/2025', M3: '30/09/2025' },
  },
  {
    name: 'API Gateway',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Platform',
    tags: ['core'],
    milestones: { START: '01/03/2025', M1: '01/06/2025', M2: '15/09/2025', M3: '15/02/2026' },
    dependencies: ['Identity Service'],
  },
  {
    name: 'Event Bus',
    atRisk: true,
    descoped: false,
    showInTimeline: true,
    group: 'Platform',
    tags: ['core', 'messaging'],
    milestones: { START: '01/09/2025', M1: '01/12/2025', M2: '01/03/2026', M3: '30/06/2026' },
    dependencies: [{ task: 'API Gateway', from: 'M2', to: 'M1' }],
  },
  {
    name: 'Observability Stack',
    atRisk: false,
    descoped: true,
    showInTimeline: true,
    group: 'Platform',
    tags: [],
    milestones: { START: '01/02/2026', M1: '01/04/2026', M2: '01/06/2026' },
  },
  {
    name: 'Web Portal',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Apps',
    tags: ['frontend'],
    link: 'https://example.com/portal',
    milestones: { START: '01/04/2025', M1: '01/07/2025', M2: '01/11/2025', M3: '15/03/2026' },
    dependencies: ['API Gateway', { task: 'Identity Service', from: 'M1', to: 'M1' }],
  },
  {
    name: 'Admin Portal',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Apps',
    tags: ['frontend', 'internal'],
    milestones: { START: '01/05/2026', M1: '01/06/2026' },
    dependencies: ['Event Bus'],
  },
  {
    name: 'Mobile App',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Apps',
    tags: ['frontend', 'mobile'],
    milestones: { START: '01/01/2026', M1: '01/03/2026', M2: '02/05/2026' },
    dependencies: [{ task: 'Data Lake', from: 'M1', to: 'M2' }],
  },
  {
    name: 'Customer Insights Dashboard With An Intentionally Very Long Name To Exercise Truncation',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Apps',
    tags: [],
    milestones: { START: '01/10/2025' },
  },
  {
    name: 'Data Lake',
    atRisk: true,
    descoped: false,
    showInTimeline: true,
    group: 'Data',
    tags: ['data', 'platform'],
    link: 'https://example.com/lake',
    milestones: { START: '01/11/2025', M1: '25/04/2026', M2: '01/06/2026' },
    dependencies: ['Identity Service'],
  },
  {
    name: 'Reporting Marts',
    atRisk: false,
    descoped: false,
    showInTimeline: false,
    group: 'Data',
    tags: ['data'],
    milestones: { START: '01/12/2025', M1: '01/02/2026', M2: '01/04/2026' },
    dependencies: [{ task: 'Data Lake', from: 'START' }],
  },
  {
    name: 'Incident Runbook',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    group: 'Ops',
    tags: ['ops'],
    milestones: { START: '01/02/2026', M1: '01/03/2026' },
  },
  {
    name: 'Vendor Contract Review',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    tags: ['legal'],
    milestones: { START: '01/03/2026', M1: '30/04/2026' },
  },
  {
    name: 'Unscheduled Spike',
    atRisk: false,
    descoped: false,
    showInTimeline: true,
    tags: [],
    milestones: { START: '' },
  },
];

export const complexConfig = {
  TIMELINE: { TODAY: '15/04/2026', START_MONTH: '01/2025', END_MONTH: '06/2026' },
  ENTITY_LABELS: { singular: 'Workstream', plural: 'Workstreams', columnHeader: 'Workstream', scopeLabel: 'workstreams' },
  DASHBOARD_TEXT: { title: 'Complex Program Dashboard', totalSubtitleSuffix: 'in program scope' },
  GROUP_ORDER: ['Platform', 'Apps', 'Data'],
  WORKFLOW: complexWorkflow,
  DELIVERABLES: complexDeliverables,
};

// Lite-only: NON_FILTERABLE_GROUPS has no database field, so it is characterized here and kept out of the parity fixture.
export const complexConfigNonFilterable = { ...complexConfig, NON_FILTERABLE_GROUPS: ['Ops'] };
