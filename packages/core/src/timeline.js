/**
 * RoadmapSnap core: timeline math (months, zoom windows, header periods, positions, date ranges).
 * Pure: no DOM, no storage, no clock. The caller supplies the bounds and today.
 */

import { parseDDMMYYYY } from './dates.js';

/**
 * One calendar column of the timeline. `date` is the first day the column covers (the first of the month,
 * or today for a partial first zoom column); `daysInMonth` is the number of days it covers.
 * @typedef {{ date: Date, name: string, daysInMonth: number }} Month
 */

/**
 * Parses MM/YYYY into the first day of that month. Returns null for anything that is not a month in 1..12
 * and a year separated by one slash.
 * @param {unknown} str
 * @returns {Date | null}
 */
export function parseMonthYear(str) {
    if (typeof str !== 'string') return null;
    const parts = str.split('/');
    if (parts.length !== 2) return null;
    if (!/^\d+$/.test(parts[0].trim()) || !/^\d+$/.test(parts[1].trim())) return null;
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    if (month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
}

/**
 * Formats a date as "Mon YYYY" (5 Jan 2026 is "Jan 2026").
 * @param {Date} date
 * @returns {string}
 */
export function getMonthName(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()] + ' ' + date.getFullYear();
}

/**
 * Every month from startMonth to endMonth inclusive (both MM/YYYY). Returns [] when either bound is
 * malformed or the end is before the start.
 * @param {string} startMonth
 * @param {string} endMonth
 * @returns {Month[]}
 */
export function generateMonths(startMonth, endMonth) {
    const start = parseMonthYear(startMonth);
    const end = parseMonthYear(endMonth);
    if (!start || !end) return [];
    /** @type {Month[]} */
    const months = [];
    const current = new Date(start);
    while (current <= end) {
        months.push({
            date: new Date(current),
            name: getMonthName(current),
            daysInMonth: new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
        });
        current.setMonth(current.getMonth() + 1);
    }
    return months;
}

/**
 * Months visible for a 3/6/12 month zoom: the timeline starts at today and shows the next `count` months,
 * with a partial first and last month when needed.
 * @param {Date} today
 * @param {number} count
 * @returns {Month[]}
 */
export function generateVisibleMonthsForZoom(today, count) {
    /** @type {Month[]} */
    const months = [];
    const startDate = new Date(today.getTime());
    // Add the months to the first of the month, then clamp the day: adding them to a 29th-31st would overflow into
    // the month after a shorter one (31 Jan + 3 months is "31 Apr", which is 1 May).
    const endMonth = new Date(today.getFullYear(), today.getMonth() + count, 1);
    const lastDayOfEndMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0).getDate();
    const endDate = new Date(endMonth.getFullYear(), endMonth.getMonth(), Math.min(today.getDate(), lastDayOfEndMonth));

    // Step through the months from their first day: setMonth on a 29th-31st would skip a short month.
    const cur = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(endDate.getTime());

    while (cur <= end) {
        const isFirst = months.length === 0;
        const isLastMonth = cur.getFullYear() === end.getFullYear() && cur.getMonth() === end.getMonth();
        const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        let segmentStart;
        let daysInSegment;
        if (isFirst && startDate.getTime() > monthStart.getTime()) {
            segmentStart = new Date(startDate.getTime());
            daysInSegment = Math.ceil((monthEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        } else if (isLastMonth && endDate.getTime() < monthEnd.getTime()) {
            segmentStart = new Date(monthStart.getTime());
            daysInSegment = endDate.getDate();
        } else {
            segmentStart = new Date(monthStart.getTime());
            daysInSegment = monthEnd.getDate();
        }
        months.push({
            date: segmentStart,
            name: getMonthName(cur),
            daysInMonth: daysInSegment
        });
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}

/**
 * Calendar half-year: 1 for January to June, 2 for July to December.
 * @param {Date} date
 * @returns {1 | 2}
 */
export function getHalfYearIndex(date) {
    return date.getMonth() < 6 ? 1 : 2;
}

/**
 * Header periods for the timeline. Month names up to 12 months, quarters ("Q1 2026") from 13 to 36 months,
 * half-years ("2026 H1") above 36. Widths are day-proportional so the header aligns with the Gantt, which
 * positions by days.
 * @param {Month[] | null | undefined} months
 * @returns {{ label: string, widthPct: number }[]}
 */
export function getTimelineHeaderPeriods(months) {
    if (!months || months.length === 0) return [];
    const totalDays = months.reduce((sum, m) => sum + m.daysInMonth, 0);
    if (totalDays <= 0) return [];
    if (months.length <= 12) {
        return months.map(m => ({ label: m.name, widthPct: (m.daysInMonth / totalDays) * 100 }));
    }
    const useHalfYear = months.length > 36;
    /** @type {{ label: string, widthPct: number }[]} */
    const periods = [];
    let i = 0;
    while (i < months.length) {
        const d = months[i].date;
        const year = d.getFullYear();
        let label;
        const bucketYear = year;
        let bucketKey;
        if (useHalfYear) {
            bucketKey = getHalfYearIndex(d);
            label = year + ' H' + bucketKey;
        } else {
            bucketKey = Math.floor(d.getMonth() / 3) + 1;
            label = 'Q' + bucketKey + ' ' + year;
        }
        let periodDays = 0;
        while (i < months.length) {
            const d2 = months[i].date;
            let sameBucket;
            if (useHalfYear) {
                sameBucket = d2.getFullYear() === bucketYear && getHalfYearIndex(d2) === bucketKey;
            } else {
                const q2 = Math.floor(d2.getMonth() / 3) + 1;
                sameBucket = d2.getFullYear() === year && q2 === bucketKey;
            }
            if (sameBucket) {
                periodDays += months[i].daysInMonth;
                i++;
            } else {
                break;
            }
        }
        periods.push({ label: label, widthPct: (periodDays / totalDays) * 100 });
    }
    return periods;
}

/**
 * Horizontal position (0..100) of a DD/MM/YYYY date on the timeline, as elapsed days over total days.
 * Null for a malformed date or an empty timeline; dates outside the range clamp to 0 or 100.
 * @param {string} dateStr
 * @param {Month[]} months
 * @returns {number | null}
 */
export function calculatePosition(dateStr, months) {
    const date = parseDDMMYYYY(dateStr);
    if (!date || !months || !months.length) return null;
    const timelineStart = months[0].date;
    const totalDays = months.reduce((sum, m) => sum + m.daysInMonth, 0);
    if (totalDays <= 0) return null;
    const daysFromStart = (date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
}

/**
 * True when a DD/MM/YYYY date falls inside the timeline (first day of the first month up to the end of the
 * last month).
 * @param {string} dateStr
 * @param {Month[]} months
 * @returns {boolean}
 */
export function isDateInRange(dateStr, months) {
    const date = parseDDMMYYYY(dateStr);
    if (!date || !months || !months.length) return false;
    const timelineStart = months[0].date;
    const last = months[months.length - 1];
    const timelineEnd = new Date(last.date.getTime());
    timelineEnd.setDate(timelineEnd.getDate() + last.daysInMonth);
    return date >= timelineStart && date < timelineEnd;
}

/**
 * Darkens a hex color by a fraction (0.5 halves each channel). Returns '#000000' for empty input.
 * @param {string | null | undefined} hex
 * @param {number} percent
 * @returns {string}
 */
export function darkenColor(hex, percent) {
    if (!hex) return '#000000';
    const digits = String(hex).replace('#', '');
    let r = parseInt(digits.substring(0, 2), 16);
    let g = parseInt(digits.substring(2, 4), 16);
    let b = parseInt(digits.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - percent)));
    g = Math.max(0, Math.floor(g * (1 - percent)));
    b = Math.max(0, Math.floor(b * (1 - percent)));
    return '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
}
