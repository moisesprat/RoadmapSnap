/**
 * DATE contract (SEC-06, D-15): milestone dates travel as YYYY-MM-DD strings in both directions
 * and never pass through a JS Date, so no server timezone can shift them. Run under
 * TZ=America/Los_Angeles and TZ=Pacific/Kiritimati (npm run test:tz). Writes go through an ad hoc
 * route passed to build({ extraRoutes }) that validates the body with the shared isoDateSchema.
 */

import { build } from '../src/server.js';
import { isoDateSchema } from '../src/lib/dates.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initTestAuth, signToken, bearer } from './helpers/auth.js';
import {
  requireDbEnv,
  adminPool,
  uniq,
  createUser,
  createOrg,
  addMember,
  createWorkspace,
  createProject,
  createMilestone,
  cleanup,
  closePools,
} from './helpers/db.js';

async function testRoutes(fastify) {
  fastify.post('/__test/milestones', {
    preHandler: [fastify.authenticate, fastify.setRequestContext, fastify.requireRole('editor')],
    schema: {
      body: {
        type: 'object',
        required: ['project_id', 'milestone_key', 'planned_date'],
        additionalProperties: false,
        properties: {
          project_id: { type: 'string', format: 'uuid' },
          milestone_key: { type: 'string', minLength: 1 },
          planned_date: isoDateSchema,
        },
      },
    },
  }, async (request, reply) => {
    const { project_id, milestone_key, planned_date } = request.body;
    await request.dbClient.query(
      'insert into milestones (project_id, org_id, milestone_key, planned_date) values ($1, $2, $3, $4::date)',
      [project_id, request.orgId, milestone_key, planned_date]
    );
    return reply.status(201).send({ ok: true });
  });
}

let app;
const fx = {};

before(async () => {
  requireDbEnv();
  await initTestAuth();

  fx.sub = uniq('dates-editor');
  fx.email = `${fx.sub}@example.com`;
  fx.user = await createUser({ sub: fx.sub, email: fx.email, name: 'Dates Editor' });
  fx.org = await createOrg({ name: 'Dates Org', slug: uniq('dates-org') });
  await addMember(fx.org.id, fx.user.id, 'editor');
  fx.workspace = await createWorkspace(fx.org.id, fx.user.id, { name: 'Dates WS', slug: uniq('dates-ws') });
  fx.project = await createProject(fx.org.id, fx.workspace.id, { name: 'Dates project' });

  app = await build({ extraRoutes: testRoutes });
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  await cleanup({ orgIds: [fx.org?.id].filter(Boolean), userIds: [fx.user?.id].filter(Boolean) });
  await closePools();
});

async function call({ method = 'GET', url, payload }) {
  const token = await signToken({ sub: fx.sub, email: fx.email, name: 'Dates Editor' });
  return app.inject({ method, url, headers: bearer(token), payload });
}

const projectsUrl = () => `/api/v1/workspaces/${fx.workspace.id}/projects`;

async function milestoneCount(key) {
  const res = await adminPool().query(
    'select count(*)::int as n from milestones where project_id = $1 and milestone_key = $2',
    [fx.project.id, key]
  );
  return res.rows[0].n;
}

test('timezone guard: when TZ is set, the process really runs in it (not a silent UTC fallback)', () => {
  if (!process.env.TZ) return;
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, process.env.TZ);
});

const ROUND_TRIP = [
  ['2026-03-31', 'month-end'],
  ['2026-01-01', 'year start'],
  ['2026-12-31', 'year end'],
  ['2024-02-29', 'leap day'],
  ['2026-03-08', 'Los Angeles DST start'],
];

for (const [date, label] of ROUND_TRIP) {
  test(`round trip: ${date} (${label}) comes back byte-for-byte unchanged`, async () => {
    const key = `RT_${date}`;
    const write = await call({
      method: 'POST',
      url: '/__test/milestones',
      payload: { project_id: fx.project.id, milestone_key: key, planned_date: date },
    });
    assert.equal(write.statusCode, 201, write.body);

    const read = await call({ url: projectsUrl() });
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().projects[0].milestones[key], date);
    assert.doesNotMatch(read.body, /T00:00:00/);
    assert.doesNotMatch(read.body, /\d{2}Z"/);
  });
}

test('a milestone with a NULL planned_date is returned as JSON null', async () => {
  await createMilestone(fx.org.id, fx.project.id, 'NODATE', null);
  const read = await call({ url: projectsUrl() });
  assert.equal(read.statusCode, 200);
  assert.equal(read.json().projects[0].milestones.NODATE, null);
});

const REJECTED = [
  '2026-02-29',
  '2026-02-30',
  '2026-04-31',
  '31/03/2026',
  '2026-3-1',
  '2026-03-31T00:00:00Z',
  '',
];

for (const bad of REJECTED) {
  test(`invalid date ${JSON.stringify(bad)} is rejected with 400 and nothing is written`, async () => {
    const key = `BAD_${bad}`;
    const res = await call({
      method: 'POST',
      url: '/__test/milestones',
      payload: { project_id: fx.project.id, milestone_key: key, planned_date: bad },
    });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(await milestoneCount(key), 0);
  });
}
