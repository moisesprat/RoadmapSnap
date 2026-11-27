# Phase 02: Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by the plan that found them.

## Found during 02-08

### CSV formula injection in the shared CSV builder

- **Symptom:** `buildCsv` (`packages/core/src/export.js`, previously Lite's `exportToCSV`) writes cells that begin with `=`, `+`, `-` or `@` unescaped, and the group and link cells are not quote-escaped at all. A deliverable named `=HYPERLINK(...)` becomes a live formula when the CSV is opened in Excel or Google Sheets.
- **Severity:** medium. Export is a user-initiated download, not on the primary trust boundary, but in the SaaS an org editor can write names that every exporting viewer opens.
- **Why deferred:** resolved OQ5. Fixing it changes Lite's CSV bytes, and this phase keeps Lite and SaaS CSV byte-identical (D-12, VIEW-06). Threat T-02-16 is accepted for this phase.
- **Suggested fix:** in `buildCsv`, prefix any cell starting with `=`, `+`, `-` or `@` with a single quote, and quote-escape the group and link cells. Update `tests/fixtures/lite-export-snapshots.json` in the same change and call out the byte change in the release notes.
- **Owner:** a later security pass.
