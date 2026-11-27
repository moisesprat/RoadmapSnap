import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDDMMYYYY,
  formatDDMMYYYY,
  formatDateDisplay,
  formatShortDate,
  isoToLite,
} from '../src/index.js';

// --- parseDDMMYYYY ---
test('parseDDMMYYYY: valid DD/MM/YYYY returns a local-midnight Date', () => {
  const d = parseDDMMYYYY('15/03/2026');
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0);
});

for (const bad of ['', null, undefined, '2026-03-15', '15/13/2026', '00/03/2026', 'a/b/c', '15/03', '15/00/2026']) {
  test(`parseDDMMYYYY: malformed input ${JSON.stringify(bad)} returns null`, () => {
    assert.equal(parseDDMMYYYY(bad), null);
  });
}

test('parseDDMMYYYY: a day past the month end rolls over natively (31/04/2026 is 1 May 2026)', () => {
  const d = parseDDMMYYYY('31/04/2026');
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 4);
  assert.equal(d.getDate(), 1);
});

// --- formatDDMMYYYY ---
test('formatDDMMYYYY: zero-pads day and month from local getters', () => {
  assert.equal(formatDDMMYYYY(new Date(2026, 0, 5)), '05/01/2026');
});

test('formatDDMMYYYY: invalid Date returns empty string', () => {
  assert.equal(formatDDMMYYYY(new Date(NaN)), '');
});

test('formatDDMMYYYY: round-trips with parseDDMMYYYY', () => {
  assert.equal(formatDDMMYYYY(parseDDMMYYYY('15/03/2026')), '15/03/2026');
});

// --- formatDateDisplay / formatShortDate (outputs identical to the pre-core Lite functions) ---
test('formatDateDisplay: "15/03/2026" is "15 Mar"', () => {
  assert.equal(formatDateDisplay('15/03/2026'), '15 Mar');
});

test('formatDateDisplay: "01/01/2026" is "1 Jan"', () => {
  assert.equal(formatDateDisplay('01/01/2026'), '1 Jan');
});

test('formatShortDate: "15/03/2026" is "15 Mar 2026"', () => {
  assert.equal(formatShortDate('15/03/2026'), '15 Mar 2026');
});

for (const bad of ['', null, undefined, 'garbage', '15/13/2026', 'a/b/c']) {
  test(`formatDateDisplay and formatShortDate: malformed ${JSON.stringify(bad)} returns empty string`, () => {
    assert.equal(formatDateDisplay(bad), '');
    assert.equal(formatShortDate(bad), '');
  });
}

// --- isoToLite (cases from packages/app/src/api/client.test.ts) ---
for (const [input, expected] of [
  ['2026-03-31', '31/03/2026'],
  ['2024-02-29', '29/02/2024'],
  ['2026-12-31', '31/12/2026'],
  [null, ''],
  [undefined, ''],
  ['', ''],
]) {
  test(`isoToLite: ${JSON.stringify(input)} maps to ${JSON.stringify(expected)}`, () => {
    assert.equal(isoToLite(input), expected);
  });
}

test('isoToLite: non-ISO strings are returned unchanged so unexpected values stay visible', () => {
  assert.equal(isoToLite('31/03/2026'), '31/03/2026');
  assert.equal(isoToLite('garbage'), 'garbage');
});
