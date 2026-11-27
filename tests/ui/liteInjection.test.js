// WR-04 and IN-01: names, group names, workflow keys and links from the config must reach Lite's click
// handlers and hrefs as data, never as JavaScript source or as an unsafe URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLiteHTML } from '../helpers/liteRender.js';
import { minimalConfig } from '../fixtures/config.minimal.js';

const APOSTROPHE = "Team's API";
const INJECTION = "x');globalThis.PWNED=1;//";
const BACKSLASH = 'Path\\';
const GROUPS = ['R&D', 'A <b> "quoted" group', "Moe's &amp; co"];

const decode = (value) => value
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

// The decoded values of one attribute, as the browser's HTML parser would hand them to a script.
const attributeValues = (markup, name) =>
  [...markup.matchAll(new RegExp(` ${name}="([^"]*)"`, 'g'))].map((m) => decode(m[1]));

// minimalConfig with Task Alpha renamed, so it has an outbound dependency and therefore a dependency icon.
function configWithNames({ name = 'Task Alpha', group = 'Group A', stateKey = 'DEV' } = {}) {
  const config = structuredClone(minimalConfig);
  const rename = (n) => (n === 'Task Alpha' ? name : n);
  for (const d of config.DELIVERABLES) {
    d.name = rename(d.name);
    if (d.group) d.group = group;
    if (d.dependencies) d.dependencies = d.dependencies.map(rename);
  }
  config.WORKFLOW.find((item) => item.key === 'DEV').key = stateKey;
  return config;
}

// No inline handler may carry any of these config values, in any escaping.
function assertNotInHandlers(markup, fragment) {
  for (const code of attributeValues(markup, 'on[a-z]+')) {
    assert.ok(!code.includes(fragment), `inline handler carries config data: ${code}`);
  }
}

for (const name of [APOSTROPHE, INJECTION, BACKSLASH]) {
  test(`a deliverable named ${name} is passed to the dependency icon as data`, async () => {
    const markup = await renderLiteHTML(configWithNames({ name }));
    assert.ok(attributeValues(markup, 'data-dependency-toggle').includes(name));
    assertNotInHandlers(markup, name);
    assert.ok(!markup.includes('toggleDependencyGraph('));
  });
}

for (const group of [...GROUPS, INJECTION]) {
  test(`a group named ${group} reaches the group header unchanged`, async () => {
    const markup = await renderLiteHTML(configWithNames({ group }));
    assert.deepEqual(attributeValues(markup, 'data-group-toggle'), [group]);
    assertNotInHandlers(markup, group);
    assert.ok(!markup.includes('toggleGroup('));
  });
}

for (const stateKey of [APOSTROPHE, INJECTION, 'A&B']) {
  test(`a workflow state keyed ${stateKey} is passed to its KPI card as data`, async () => {
    const markup = await renderLiteHTML(configWithNames({ stateKey }));
    assert.ok(attributeValues(markup, 'data-status-filter').includes(stateKey));
    assertNotInHandlers(markup, stateKey);
    assert.ok(!markup.includes('filterByStatus('));
  });
}

async function infoLinks(link) {
  const config = structuredClone(minimalConfig);
  config.DELIVERABLES[0].link = link;
  const markup = await renderLiteHTML(config);
  return [...markup.matchAll(/<a class="info-link" href="([^"]*)"/g)].map((m) => decode(m[1]));
}

const UNSAFE_LINKS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//example.com/protocol-relative',
  '/relative/path',
  'not a url',
  '   ',
];

for (const link of UNSAFE_LINKS) {
  test(`no info link is rendered for ${JSON.stringify(link)}`, async () => {
    assert.deepEqual(await infoLinks(link), []);
  });
}

test('an http(s) link is rendered, trimmed, with its query string intact', async () => {
  assert.deepEqual(await infoLinks('http://example.com/a'), ['http://example.com/a']);
  assert.deepEqual(await infoLinks('  https://example.com/a?x=1&y="2"  '), ['https://example.com/a?x=1&y="2"']);
});
