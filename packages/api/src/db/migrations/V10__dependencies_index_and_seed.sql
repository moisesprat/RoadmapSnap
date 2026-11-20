-- Indexes for dependency lookups (GET /workspaces/:id/projects).
-- Table dependencies is created in V1__core_schema.sql.
--
-- Since Phase 1 (decision D-01) this file keeps only the two indexes below. The demo dependency it
-- used to insert moved to `npm run seed:dev`. The filename is unchanged so the version recorded in
-- schema_migrations stays the same: migrate.js tracks versions by filename only, so databases that
-- already applied the old content skip this file (D-04). Editing it is a documented exception to
-- the never-edit-an-applied-migration rule.
CREATE INDEX IF NOT EXISTS idx_dependencies_to_project ON dependencies(to_project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_from_project ON dependencies(from_project_id);
