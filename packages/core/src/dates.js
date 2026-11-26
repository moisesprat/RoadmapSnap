/**
 * RoadmapSnap core: the one canonical DD/MM/YYYY implementation (D-15).
 * Pure: no DOM, no storage, no clock. Lite (js/core/timeline.js) and the SaaS app both bind to
 * these functions instead of keeping their own copies.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Splits a DD/MM/YYYY string into integer parts. Returns null for anything that is not three
 * `/`-separated integers, a month outside 1..12 or a day below 1. A day past the month end is
 * accepted here (it rolls over natively when turned into a Date).
 * @param {unknown} str
 * @returns {{ day: number, month: number, year: number, yearText: string } | null}
 */
function splitDate(str) {
    if (typeof str !== 'string') return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    for (let i = 0; i < 3; i++) {
        if (!/^\d+$/.test(parts[i].trim())) return null;
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (month < 1 || month > 12 || day < 1) return null;
    return { day, month, year, yearText: parts[2].trim() };
}

/**
 * Parses DD/MM/YYYY into a local-midnight Date. Returns null for malformed input. A day past the
 * month end rolls over natively (31/04/2026 is 1 May 2026).
 * @param {unknown} str
 * @returns {Date | null}
 */
function parseDDMMYYYY(str) {
    const parts = splitDate(str);
    if (!parts) return null;
    return new Date(parts.year, parts.month - 1, parts.day);
}

/**
 * Formats a Date as zero-padded DD/MM/YYYY from local getters. Returns '' for an invalid Date.
 * @param {unknown} date
 * @returns {string}
 */
function formatDDMMYYYY(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear()).padStart(4, '0');
    return dd + '/' + mm + '/' + yyyy;
}

/**
 * Formats DD/MM/YYYY as "D Mon" (15/03/2026 is "15 Mar"). Returns '' for malformed input.
 * @param {unknown} str
 * @returns {string}
 */
function formatDateDisplay(str) {
    const parts = splitDate(str);
    if (!parts) return '';
    return parts.day + ' ' + MONTH_NAMES[parts.month - 1];
}

/**
 * Formats DD/MM/YYYY as "D Mon YYYY" (15/03/2026 is "15 Mar 2026"). Returns '' for malformed input.
 * @param {unknown} str
 * @returns {string}
 */
function formatShortDate(str) {
    const parts = splitDate(str);
    if (!parts) return '';
    return parts.day + ' ' + MONTH_NAMES[parts.month - 1] + ' ' + parts.yearText;
}

/**
 * Converts an API ISO date (YYYY-MM-DD) to DD/MM/YYYY using string operations only, so no timezone
 * can shift it. null, undefined and '' become ''. Any other string is returned unchanged so an
 * unexpected value stays visible in the UI instead of disappearing.
 * @param {string | null | undefined} value
 * @returns {string}
 */
function isoToLite(value) {
    if (value == null || value === '') return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const [yyyy, mm, dd] = value.split('-');
    return dd + '/' + mm + '/' + yyyy;
}

export { parseDDMMYYYY, formatDDMMYYYY, formatDateDisplay, formatShortDate, isoToLite };
