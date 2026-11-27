/**
 * RoadmapSnap — timeline & date utilities (Lite binding)
 * Binding over @roadmapsnap/core: the date, month, header-period and position math lives in
 * packages/core/src/{dates,timeline}.js. This file keeps Lite's names, its empty-input contract and the
 * two reads that stay in Lite: CONFIG.TIMELINE (today, month range) and the clock.
 * Exported on window for global access.
 */

import * as core from '@roadmapsnap/core';

function parseDate(dateStr) {
    if (!dateStr) return null;
    return core.parseDDMMYYYY(dateStr);
}

function formatDateDisplay(dateStr) {
    return core.formatDateDisplay(dateStr);
}

function formatShortDate(dateStr) {
    return core.formatShortDate(dateStr);
}

function darkenColor(hex, percent) {
    return core.darkenColor(hex, percent);
}

function getTodayDate() {
    if (typeof CONFIG !== 'undefined' && CONFIG.TIMELINE && CONFIG.TIMELINE.TODAY) {
        return CONFIG.TIMELINE.TODAY;
    }
    return core.formatDDMMYYYY(new Date());
}

function parseMonthYear(monthYearStr) {
    return core.parseMonthYear(monthYearStr);
}

function getMonthName(date) {
    return core.getMonthName(date);
}

function generateMonths() {
    return core.generateMonths(CONFIG.TIMELINE.START_MONTH, CONFIG.TIMELINE.END_MONTH);
}

function generateVisibleMonthsForZoom(today, count) {
    return core.generateVisibleMonthsForZoom(today, count);
}

function getTimelineHeaderPeriods(months) {
    return core.getTimelineHeaderPeriods(months);
}

function calculatePosition(dateStr, months) {
    return core.calculatePosition(dateStr, months);
}

function isDateInRange(dateStr, months) {
    return core.isDateInRange(dateStr, months);
}

// Export on window for global access
window.parseDate = parseDate;
window.formatDateDisplay = formatDateDisplay;
window.formatShortDate = formatShortDate;
window.darkenColor = darkenColor;
window.getTodayDate = getTodayDate;
window.parseMonthYear = parseMonthYear;
window.getMonthName = getMonthName;
window.generateMonths = generateMonths;
window.generateVisibleMonthsForZoom = generateVisibleMonthsForZoom;
window.getTimelineHeaderPeriods = getTimelineHeaderPeriods;
window.calculatePosition = calculatePosition;
window.isDateInRange = isDateInRange;

export {
    parseDate, formatDateDisplay, formatShortDate, darkenColor, getTodayDate,
    parseMonthYear, getMonthName, generateMonths, generateVisibleMonthsForZoom, getTimelineHeaderPeriods, calculatePosition, isDateInRange
};
