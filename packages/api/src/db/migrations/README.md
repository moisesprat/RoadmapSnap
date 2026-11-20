# Database migrations

## Migrations are schema-only

`npm run migrate` (from `packages/api`) runs as the owner role from `DATABASE_URL`. It applies every
`.sql` file in this directory in numeric order and records each one by filename in
`schema_migrations`. A file that is already recorded is skipped even if its content changed.

Migrations create the schema, policies, indexes and roles and nothing else. A fresh install has the
tables and no rows. Demo data comes only from `npm run seed:dev` (see below).

## V7-V12 are intentionally empty

Until Phase 1 (decision D-01), V7-V12 seeded projects, memberships, workflows, dependencies and
group order from the `js/config*.js` files. They are now stubs with a comment, except V10, which
keeps its two dependency indexes (`idx_dependencies_to_project`, `idx_dependencies_from_project`).

The filenames are unchanged on purpose. Versions are tracked by filename, so databases that already
applied the old content skip these files and keep their data (D-04). Emptying an applied migration
is a documented exception to the never-edit-an-applied-migration rule. For every other migration the
rule stands: add a new file with the next free `V` number.

## V13 tenant policies

V13 makes the row-level security policies safe for the request path, where the API connects as
`roadmapsnap_app` (NOSUPERUSER) and sets tenant context with parameterized `set_config(..., true)`:

- NULLIF-safe `app_current_org_id()`, `app_current_user_id()` and `app_current_auth0_id()` readers,
  so an unset or reset context matches no rows instead of raising a cast error.
- The `org_isolation` policies rewritten onto those readers.
- Self-select policies so a caller can list its own memberships and the organizations they point at
  before an org is chosen.
- Row-level security on `users`: a caller sees its own row and its co-members in the active org.
- App-role hardening: no access to `schema_migrations`, no UPDATE or DELETE on `audit_events`, a
  pinned `search_path` on the audit trigger function, and an idle-in-transaction timeout.

## Demo data: `npm run seed:dev`

```bash
npm run seed:dev -- --sub <your Auth0 sub>
```

Creates two synthetic organizations:

- **Demo Org A** (`dev-org-a`): workspace `demo-roadmap` with 10 deliverables in Team A and Team B,
  milestones, and three dependencies. The subject becomes its admin.
- **Demo Org B** (`dev-org-b`): workspace `launch-plan` with a different 4-item roadmap, owned by a
  synthetic user that cannot sign in. The subject is not a member, so the two orgs can be used to
  check tenant isolation by hand.

Options:

| Flag | Environment variable | Meaning |
|------|----------------------|---------|
| `--sub` | `DEV_ADMIN_SUB` | Auth0 subject of the developer (required) |
| `--email` | `DEV_ADMIN_EMAIL` | Email stored for the subject (default `dev-admin@local.dev`) |
| `--name` | | Display name (default `Dev Admin`) |
| `--member-of-b viewer\|editor\|admin` | | Also join Demo Org B with that role |

Rules:

- It is idempotent: running it again updates the same rows instead of adding new ones. Each
  re-run does add `audit_events` rows for the updates it makes.
- It runs only as the owner role from `DATABASE_URL`, never at request time, and never reads
  `APP_DATABASE_URL`.
- It refuses to run when `NODE_ENV=production`, and when no subject is given, before it connects.
- `seedDev({ client, sub, email, name, memberOfB })` in `src/db/seeds/dev.js` is importable for
  tests and scripts. The data lives in `src/db/seeds/devData.js`.

## Existing local databases

There is no cleanup migration, by design (D-04). A local database that already holds data from the
old migration seeds keeps it. To start clean, drop and recreate the database, then migrate and seed:

```bash
docker exec roadmapsnap-pg dropdb -U postgres roadmapsnap_dev
docker exec roadmapsnap-pg createdb -U postgres roadmapsnap_dev
npm run migrate
npm run seed:dev -- --sub <your Auth0 sub>
```

## Superuser name

V2 grants table access to a role literally named `postgres`, so the cluster must use that superuser
name. CI and the compose skeleton do. Phase 7 revisits this for hosted databases.
