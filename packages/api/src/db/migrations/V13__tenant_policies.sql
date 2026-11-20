-- V13: tenant policies for request-path RLS.
--
-- The API now connects as roadmapsnap_app (NOSUPERUSER) and runs every request inside one
-- transaction, setting tenant context with parameterized set_config(name, $1, true).
-- This migration makes the policies safe for that model. It adds no privileged function,
-- no RLS bypass attribute and no row-security setting change.

-- Block 1: NULLIF-safe GUC readers.
-- After a transaction that used set_config(..., true), a pooled session reports '' (not NULL)
-- for the setting, and a bare ''::uuid cast raises 22P02. These readers turn '' into NULL, so
-- an unset or reset context matches no rows instead of erroring.
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_current_auth0_id() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.current_auth0_id', true), '') $$;

-- Block 2: rewrite the V2 org_isolation policies onto the readers.
-- ALTER POLICY ... USING keeps the implicit WITH CHECK = USING of a FOR ALL policy.
ALTER POLICY org_isolation ON organizations  USING (id = app_current_org_id());
ALTER POLICY org_isolation ON org_members    USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON workspaces     USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON programs       USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON projects       USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON milestones     USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON budget_periods USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON kpis           USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON risks          USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON dependencies   USING (org_id = app_current_org_id());
ALTER POLICY org_isolation ON audit_events   USING (org_id = app_current_org_id());

-- Block 3: identity-stage self-select policies (no SECURITY DEFINER lookup).
-- Before an org is chosen, a caller can list only its own memberships and the organizations
-- those memberships point at. Permissive policies are OR-ed with org_isolation.
CREATE POLICY member_self_select ON org_members FOR SELECT
  USING (user_id = app_current_user_id());
CREATE POLICY member_orgs_select ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = app_current_user_id()));

-- Block 4: users get RLS too (closes cross-tenant email enumeration).
-- A caller sees its own row (keyed on the verified JWT sub or the resolved user id) and, for
-- the active org only, its co-members. No policy recursion: users policies read org_members,
-- and org_members policies reference only the GUC readers.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY user_self ON users
  USING (auth0_id = app_current_auth0_id() OR id = app_current_user_id());
CREATE POLICY user_comember_select ON users FOR SELECT
  USING (id IN (SELECT user_id FROM org_members WHERE org_id = app_current_org_id()));

-- Block 5: app-role hardening.
-- V4 granted DML on ALL TABLES, which includes schema_migrations: the app role could rewrite
-- migration history.
REVOKE ALL ON schema_migrations FROM roadmapsnap_app;
-- The audit trigger is SECURITY DEFINER and inserts as its owner, so the app role needs no
-- UPDATE or DELETE on the audit log.
REVOKE UPDATE, DELETE ON audit_events FROM roadmapsnap_app;
-- SECURITY DEFINER functions must not resolve names through a caller-controlled search_path.
ALTER FUNCTION audit_trigger_function() SET search_path = public, pg_temp;
-- A leaked open transaction must not pin a pooled connection forever.
ALTER ROLE roadmapsnap_app SET idle_in_transaction_session_timeout = '30s';
