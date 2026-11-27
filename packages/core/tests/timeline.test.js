import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.js';
import { complexConfig } from '../../../tests/fixtures/config.complex.js';

// Positions are local-time Date differences, so a DST change inside the range shifts them by fractions of a
// percent. Pin the zone so the exact values below hold on every machine and in CI.
process.env.TZ = 'UTC';

// Calendar months for tests that need a month list without going through generateMonths.
function monthsFrom(year, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(year, i, 1);
    list.push({ date, name: core.getMonthName(date), daysInMonth: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() });
  }
  return list;
}

test('parseMonthYear parses MM/YYYY to the first of that month', () => {
  const d = core.parseMonthYear('03/2026');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 1);
});

for (const bad of ['13/2026', '00/2026', '', null, undefined, 'bad', '2026', '01/2026/05', 'a/b']) {
  test(`parseMonthYear returns null for malformed input ${JSON.stringify(bad)}`, () => {
    assert.equal(core.parseMonthYear(bad), null);
  });
}

test('getMonthName formats a date as "Mon YYYY"', () => {
  assert.equal(core.getMonthName(new Date(2026, 0, 5)), 'Jan 2026');
  assert.equal(core.getMonthName(new Date(2026, 11, 31)), 'Dec 2026');
});

test('generateMonths("01/2025", "06/2026") returns 18 months starting January 2025 with 31 days', () => {
  const months = core.generateMonths('01/2025', '06/2026');
  assert.equal(months.length, 18);
  assert.equal(months[0].name, 'Jan 2025');
  assert.equal(months[0].daysInMonth, 31);
  assert.equal(months[17].name, 'Jun 2026');
  assert.equal(months[1].daysInMonth, 28);
});

test('generateMonths returns [] when either bound is malformed', () => {
  assert.deepEqual(core.generateMonths('bad', '06/2026'), []);
  assert.deepEqual(core.generateMonths('01/2025', 'bad'), []);
  assert.deepEqual(core.generateMonths('', ''), []);
});

test('generateMonths returns [] when the end is before the start and one month when they are equal', () => {
  assert.deepEqual(core.generateMonths('06/2026', '01/2026'), []);
  assert.equal(core.generateMonths('06/2026', '06/2026').length, 1);
});

test('generateVisibleMonthsForZoom starts at today and ends count months later, with partial first and last months', () => {
  const months = core.generateVisibleMonthsForZoom(new Date(2026, 3, 15), 6);
  assert.deepEqual(
    months.map((m) => [m.name, m.daysInMonth]),
    [['Apr 2026', 16], ['May 2026', 31], ['Jun 2026', 30], ['Jul 2026', 31], ['Aug 2026', 31], ['Sep 2026', 30], ['Oct 2026', 15]],
  );
  assert.equal(months[0].date.getDate(), 15);
  assert.equal(months[1].date.getDate(), 1);
});

// CR-03: stepping or adding months from the 29th-31st overflowed into the month after the short one.
const zoomNames = (today, count) =>
  core.generateVisibleMonthsForZoom(today, count).map((m) => [m.name, m.daysInMonth]);

test('generateVisibleMonthsForZoom keeps every month when today is 31 January (CR-03)', () => {
  assert.deepEqual(zoomNames(new Date(2026, 0, 31), 3), [
    ['Jan 2026', 1], ['Feb 2026', 28], ['Mar 2026', 31], ['Apr 2026', 30],
  ]);
});

test('generateVisibleMonthsForZoom keeps every month when today is 30 January (CR-03)', () => {
  assert.deepEqual(zoomNames(new Date(2026, 0, 30), 3), [
    ['Jan 2026', 2], ['Feb 2026', 28], ['Mar 2026', 31], ['Apr 2026', 30],
  ]);
});

test('generateVisibleMonthsForZoom keeps every month when today is 29 January of a non-leap year (CR-03)', () => {
  assert.deepEqual(zoomNames(new Date(2027, 0, 29), 3), [
    ['Jan 2027', 3], ['Feb 2027', 28], ['Mar 2027', 31], ['Apr 2027', 29],
  ]);
});

test('generateVisibleMonthsForZoom ends in a leap-year February on its 29th (CR-03)', () => {
  for (const day of [29, 30, 31]) {
    const months = zoomNames(new Date(2028, 0, day), 1);
    assert.deepEqual(months, [['Jan 2028', 32 - day], ['Feb 2028', 29]], 'day ' + day);
  }
  // 29 January 2027 is not a leap year: the end clamps to 28 February.
  assert.deepEqual(zoomNames(new Date(2027, 0, 29), 1), [['Jan 2027', 3], ['Feb 2027', 28]]);
});

test('generateVisibleMonthsForZoom keeps every month from 31 August across 6 and 12 months (CR-03)', () => {
  assert.deepEqual(zoomNames(new Date(2026, 7, 31), 6), [
    ['Aug 2026', 1], ['Sep 2026', 30], ['Oct 2026', 31], ['Nov 2026', 30], ['Dec 2026', 31], ['Jan 2027', 31], ['Feb 2027', 28],
  ]);
  const year = core.generateVisibleMonthsForZoom(new Date(2026, 7, 31), 12);
  assert.equal(year.length, 13);
  assert.equal(year[12].name, 'Aug 2027');
  assert.equal(year[12].daysInMonth, 31);
});

test('generateVisibleMonthsForZoom lists consecutive calendar months for every start day of every month (CR-03)', () => {
  for (const year of [2026, 2028]) {
    for (let month = 0; month < 12; month++) {
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        for (const count of [3, 6, 12]) {
          const months = core.generateVisibleMonthsForZoom(new Date(year, month, day), count);
          const label = `${year}-${month + 1}-${day} zoom ${count}`;
          assert.equal(months.length, count + 1, label);
          months.forEach((m, i) => {
            const expected = new Date(year, month + i, 1);
            assert.equal(m.name, core.getMonthName(expected), label);
          });
          const target = new Date(year, month + count, 1);
          const targetLast = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          assert.equal(months[count].daysInMonth, Math.min(day, targetLast), label);
        }
      }
    }
  }
});

test('generateVisibleMonthsForZoom does not mutate its today argument', () => {
  const today = new Date(2026, 3, 15);
  core.generateVisibleMonthsForZoom(today, 3);
  assert.equal(today.getTime(), new Date(2026, 3, 15).getTime());
});

test('getHalfYearIndex is 1 for January-June and 2 for July-December', () => {
  assert.equal(core.getHalfYearIndex(new Date(2026, 0, 1)), 1);
  assert.equal(core.getHalfYearIndex(new Date(2026, 5, 30)), 1);
  assert.equal(core.getHalfYearIndex(new Date(2026, 6, 1)), 2);
  assert.equal(core.getHalfYearIndex(new Date(2026, 11, 31)), 2);
});

test('getTimelineHeaderPeriods uses months up to 12, quarters up to 36 and half-years above', () => {
  assert.deepEqual(core.getTimelineHeaderPeriods(monthsFrom(2025, 12)).map((p) => p.label).slice(0, 2), ['Jan 2025', 'Feb 2025']);
  assert.equal(core.getTimelineHeaderPeriods(monthsFrom(2025, 12)).length, 12);
  assert.deepEqual(core.getTimelineHeaderPeriods(monthsFrom(2025, 13)).map((p) => p.label), ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026']);
  assert.equal(core.getTimelineHeaderPeriods(monthsFrom(2025, 36)).length, 12);
  assert.equal(core.getTimelineHeaderPeriods(monthsFrom(2025, 36))[0].label, 'Q1 2025');
  assert.deepEqual(
    core.getTimelineHeaderPeriods(monthsFrom(2025, 37)).map((p) => p.label),
    ['2025 H1', '2025 H2', '2026 H1', '2026 H2', '2027 H1', '2027 H2', '2028 H1'],
  );
});

test('getTimelineHeaderPeriods matches the recorded Lite periods for the complex fixture range (18 months)', () => {
  const months = core.generateMonths(complexConfig.TIMELINE.START_MONTH, complexConfig.TIMELINE.END_MONTH);
  assert.deepEqual(core.getTimelineHeaderPeriods(months), [
    { label: 'Q1 2025', widthPct: 16.483516483516482 },
    { label: 'Q2 2025', widthPct: 16.666666666666664 },
    { label: 'Q3 2025', widthPct: 16.84981684981685 },
    { label: 'Q4 2025', widthPct: 16.84981684981685 },
    { label: 'Q1 2026', widthPct: 16.483516483516482 },
    { label: 'Q2 2026', widthPct: 16.666666666666664 },
  ]);
});

test('getTimelineHeaderPeriods returns [] for no months', () => {
  assert.deepEqual(core.getTimelineHeaderPeriods([]), []);
  assert.deepEqual(core.getTimelineHeaderPeriods(null), []);
});

test('getTimelineHeaderPeriods month widths are day-proportional and sum to 100', () => {
  const periods = core.getTimelineHeaderPeriods(monthsFrom(2026, 3));
  assert.equal(periods.length, 3);
  assert.ok(Math.abs(periods.reduce((s, p) => s + p.widthPct, 0) - 100) < 1e-9);
  assert.ok(Math.abs(periods[0].widthPct - (31 / 90) * 100) < 1e-9);
});

test('calculatePosition (adjacency): the first day of a month sits exactly on that month left boundary', () => {
  const months = monthsFrom(2026, 12);
  assert.equal(core.calculatePosition('01/01/2026', months), 0);
  // 01/05/2026 follows January-April, 31 + 28 + 31 + 30 = 120 of 365 days
  assert.equal(core.calculatePosition('01/05/2026', months), (120 / 365) * 100);
});

test('calculatePosition clamps to the range and returns null for a bad date or no months', () => {
  const months = monthsFrom(2026, 12);
  assert.equal(core.calculatePosition('01/01/2025', months), 0);
  assert.equal(core.calculatePosition('01/01/2030', months), 100);
  assert.equal(core.calculatePosition('garbage', months), null);
  assert.equal(core.calculatePosition('', months), null);
  assert.equal(core.calculatePosition('01/05/2026', []), null);
});

test('isDateInRange includes the first day of the range and excludes the day after the last month', () => {
  const months = core.generateMonths('01/2026', '06/2026');
  assert.equal(core.isDateInRange('01/01/2026', months), true);
  assert.equal(core.isDateInRange('30/06/2026', months), true);
  assert.equal(core.isDateInRange('01/07/2026', months), false);
  assert.equal(core.isDateInRange('31/12/2025', months), false);
  assert.equal(core.isDateInRange('bad', months), false);
  assert.equal(core.isDateInRange('01/01/2026', []), false);
});

test('darkenColor darkens a hex color by a fraction and returns black for empty input', () => {
  assert.equal(core.darkenColor('#ff8000', 0.5), '#7f4000');
  assert.equal(core.darkenColor('ffffff', 0), '#ffffff');
  assert.equal(core.darkenColor('', 0.5), '#000000');
  assert.equal(core.darkenColor(null, 0.5), '#000000');
});
