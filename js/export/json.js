/**
 * RoadmapSnap — JSON export
 * Binding over @roadmapsnap/core: the JSON content is built by buildJson in packages/core/src/export.js.
 * The clock read (exportDate) stays here. Depends on window.downloadFile, window.getTodayDate and CONFIG.
 */
import { buildJson, EXPORT_FILENAMES } from '@roadmapsnap/core';

function exportToJSON() {
    const jsonContent = buildJson(CONFIG, { today: window.getTodayDate(), now: new Date().toISOString() });
    window.downloadFile(jsonContent, EXPORT_FILENAMES.json, 'application/json');
}

// Export on window for global access
window.exportToJSON = exportToJSON;
