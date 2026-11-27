/**
 * Synthetic demo data for `npm run seed:dev` (data only, no I/O).
 *
 * Demo Org A is hand-copied from js/config_base.js (the only config file allowed as a source,
 * D-03) with milestone dates converted by hand from DD/MM/YYYY to ISO YYYY-MM-DD. Nothing here is
 * parsed or evaluated from a config file at runtime (D-05). config_base has no dependencies, so
 * the three below are synthetic. Demo Org B is a different, wholly invented roadmap.
 */

export const DEFAULT_ADMIN_EMAIL = 'dev-admin@local.dev';

// The five distinct milestone schedules used by config_base deliverables, in ISO form.
const SCHEDULE_1 = {
  START: '2025-06-01', A0: '2025-06-15', A1: '2025-08-01', A2: '2025-09-15',
  A3: '2025-11-01', A4: '2025-12-15', A5: '2026-02-01',
};
const SCHEDULE_2 = {
  START: '2025-08-01', A0: '2025-09-15', A1: '2025-11-01', A2: '2025-12-15',
  A3: '2026-02-01', A4: '2026-03-15', A5: '2026-05-01',
};
const SCHEDULE_3 = {
  START: '2025-10-01', A0: '2025-11-15', A1: '2026-01-01', A2: '2026-02-15',
  A3: '2026-04-01', A4: '2026-05-15', A5: '2026-06-01',
};
const SCHEDULE_4 = {
  START: '2025-12-01', A0: '2026-01-15', A1: '2026-03-01', A2: '2026-04-15',
  A3: '2026-05-01', A4: '2026-06-15', A5: '2026-07-01',
};
const SCHEDULE_5 = {
  START: '2026-02-01', A0: '2026-03-15', A1: '2026-05-01', A2: '2026-05-15',
  A3: '2026-06-01', A4: '2026-06-15', A5: '2026-07-01',
};

function deliverable(n, group, atRisk, milestones) {
  return {
    name: `Deliverable ${n}`,
    group_name: group,
    at_risk: atRisk,
    show_in_timeline: true,
    display_order: n * 10,
    milestones,
  };
}

export const DEMO_ORG_A = {
  name: 'Demo Org A',
  slug: 'dev-org-a',
  workspace: {
    name: 'Demo Roadmap',
    slug: 'demo-roadmap',
    workflow_definition: [
      { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: 'Pending kickoff' },
      { type: 'milestone', key: 'START', short: 'STR', title: 'Start', subtitle: 'Project Kickoff' },
      { type: 'state', key: 'DSN', short: 'UX', title: 'In Design', description: 'Design phase' },
      { type: 'milestone', key: 'A0', short: 'A0', title: 'Design Complete', subtitle: 'Design Phase Done' },
      { type: 'state', key: 'DEV', short: 'DEV', title: 'In Development', description: 'Active development' },
      { type: 'milestone', key: 'A1', short: 'A1', title: 'Dev Complete', subtitle: 'Development Finished' },
      { type: 'state', key: 'QA', short: 'QA', title: 'Under QA', description: 'Quality assurance testing' },
      { type: 'milestone', key: 'A2', short: 'A2', title: 'QA Validated', subtitle: 'Testing Passed' },
      { type: 'state', key: 'UAT', short: 'UAT', title: 'Under UAT', description: 'User acceptance testing' },
      { type: 'milestone', key: 'A3', short: 'A3', title: 'UAT Approved', subtitle: 'User Acceptance' },
      { type: 'state', key: 'STG', short: 'STG', title: 'In Staging', description: 'Staging environment' },
      { type: 'milestone', key: 'A4', short: 'A4', title: 'Staging Ready', subtitle: 'Pre-Production' },
      { type: 'state', key: 'DPL', short: 'DPL', title: 'Deploying', description: 'Deploying to production' },
      { type: 'milestone', key: 'A5', short: 'A5', title: 'Production Live', subtitle: 'Released to Prod' },
      { type: 'state', key: 'PRD', short: 'PRD', title: 'In Production', description: 'Live in production' },
    ],
    entity_labels: {
      singular: 'Deliverable',
      plural: 'Deliverables',
      columnHeader: 'Deliverable',
      scopeLabel: 'deliverables',
    },
    dashboard_text: {
      title: 'Project Roadmap Dashboard',
      totalSubtitleSuffix: 'in roadmap scope',
    },
    settings: {
      start_month: '05/2025',
      end_month: '07/2026',
      group_order: ['Team A', 'Team B'],
    },
  },
  projects: [
    deliverable(1, 'Team A', false, SCHEDULE_1),
    deliverable(2, 'Team A', false, SCHEDULE_1),
    deliverable(3, 'Team A', true, SCHEDULE_2),
    deliverable(4, 'Team A', false, SCHEDULE_2),
    deliverable(5, 'Team B', false, SCHEDULE_3),
    deliverable(6, 'Team B', false, SCHEDULE_3),
    deliverable(7, 'Team B', true, SCHEDULE_4),
    deliverable(8, 'Team B', false, SCHEDULE_4),
    deliverable(9, 'Team B', false, SCHEDULE_5),
    deliverable(10, 'Team B', false, SCHEDULE_5),
  ],
  // from = the blocking project, to = the blocked project.
  dependencies: [
    { from: 'Deliverable 1', to: 'Deliverable 3' },
    { from: 'Deliverable 2', to: 'Deliverable 5', from_milestone_key: 'A2', to_milestone_key: 'START' },
    { from: 'Deliverable 4', to: 'Deliverable 7' },
  ],
};

function initiative(n, label, group, atRisk, milestones) {
  return {
    name: `Initiative ${label} ${n}`,
    group_name: group,
    at_risk: atRisk,
    show_in_timeline: true,
    display_order: 0,
    milestones,
  };
}

export const DEMO_ORG_B = {
  name: 'Demo Org B',
  slug: 'dev-org-b',
  // Synthetic owner that cannot sign in (there is no Auth0 identity behind it).
  admin: { sub: 'dev|org-b-admin', email: 'org-b-admin@local.dev', name: 'Org B Admin' },
  workspace: {
    name: 'Launch Plan',
    slug: 'launch-plan',
    workflow_definition: [
      { type: 'state', key: 'NS', short: 'NS', title: 'Not Started', description: 'Waiting for planning' },
      { type: 'milestone', key: 'PLAN', short: 'PLN', title: 'Plan Approved', subtitle: 'Scope Agreed' },
      { type: 'state', key: 'BLD', short: 'BLD', title: 'Building', description: 'Work in progress' },
      { type: 'milestone', key: 'BUILD', short: 'BLT', title: 'Build Complete', subtitle: 'Ready to Ship' },
      { type: 'state', key: 'RLS', short: 'RLS', title: 'Releasing', description: 'Rolling out' },
      { type: 'milestone', key: 'LAUNCH', short: 'LCH', title: 'Launched', subtitle: 'Live for Customers' },
      { type: 'state', key: 'LIVE', short: 'LIVE', title: 'Live', description: 'Running in the field' },
    ],
    entity_labels: {
      singular: 'Initiative',
      plural: 'Initiatives',
      columnHeader: 'Initiative',
      scopeLabel: 'initiatives',
    },
    dashboard_text: {
      title: 'Launch Plan Dashboard',
      totalSubtitleSuffix: 'in launch scope',
    },
    settings: {
      start_month: '01/2026',
      end_month: '12/2026',
      group_order: ['Alpha', 'Beta'],
    },
  },
  projects: [
    initiative(1, 'Alpha', 'Alpha', false, { PLAN: '2026-01-15', BUILD: '2026-04-01', LAUNCH: '2026-05-15' }),
    initiative(2, 'Alpha', 'Alpha', false, { PLAN: '2026-02-01', BUILD: '2026-05-01', LAUNCH: '2026-06-15' }),
    initiative(1, 'Beta', 'Beta', true, { PLAN: '2026-04-01', BUILD: '2026-08-01', LAUNCH: '2026-09-15' }),
    initiative(2, 'Beta', 'Beta', false, { PLAN: '2026-06-01', BUILD: '2026-10-01', LAUNCH: '2026-11-15' }),
  ].map((p, i) => ({ ...p, display_order: (i + 1) * 10 })),
  dependencies: [
    { from: 'Initiative Alpha 1', to: 'Initiative Beta 1' },
  ],
};
