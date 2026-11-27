/**
 * RoadmapSnap — CSV export
 * Binding over @roadmapsnap/core: the CSV content is built by buildCsv in packages/core/src/export.js.
 * This file reads CONFIG and the clock (via getTodayDate) only to supply arguments, and owns the download.
 * Depends on getTodayDate and CONFIG (window).
 */
import { buildCsv, EXPORT_FILENAMES } from '@roadmapsnap/core';

function exportToCSV() {
    downloadFile(buildCsv(CONFIG, { today: window.getTodayDate() }), EXPORT_FILENAMES.csv, 'text/csv');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Export on window for global access
window.exportToCSV = exportToCSV;
window.downloadFile = downloadFile;
