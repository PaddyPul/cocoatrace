# Safe migration startup

Backlog: ENV-019, ENV-007, QLT-005. Decision:
[ADR 001](../adr/001-frozen-schema-bootstrap.md).

The normal application/release command is `npm run db:migrate` from the repo
root. Containers continue to use `tsx api/scripts/migrate.ts` before starting
the compiled API. The frozen schema, applied migrations and integrity manifest
are unchanged. Do not use the obsolete `db:migrate:js` alias.

## Behavior

| Database state | Action |
| --- | --- |
| Empty public schema, no ledger | Load verified frozen snapshot through 010, record all canonical baseline names, apply forward migrations |
| Complete baseline and valid forward prefix | Apply pending forwards; preserve existing data and ledger entries |
| Fully current database | No migration ledger changes |
| Objects without migration history | Refuse automatic adoption; leave existing objects/data untouched |
| Empty, partial, duplicate, unknown or gapped history | Refuse before schema changes; investigate matching files and backups |
| Stale Knex migration lock | Refuse; do not automatically unlock |
| Forward migration disables transactions | Refuse; require a separately reviewed release strategy |

The baseline includes two migrations numbered 002; names, not just numeric
versions, define the boundary. The production module owns this definition,
and integration tests re-export it. No automatic schema reset or migration
history reconciliation is part of startup.

One PostgreSQL transaction covers inspection, snapshot, ledger and all pending
forward migrations. A transaction advisory lock serializes concurrent callers.
The lock wait is bounded to 120 seconds. The runner uses the typed database pool
maximum and closes connections on success/failure. A real forward SQL failure
rolls back earlier changes in that invocation, including data changes and Knex
lock writes. Existing deployments retain their original baseline timestamps.

## Automated gate

Start Docker Desktop and run from the repository root:

```powershell
npm run test:migrations:docker
```

The fixed `cocoatrace-migration-tests` project builds the normal API image and
starts PostgreSQL 16 with tmpfs storage and no published database port. The
fixture harness requires the exact `cocoatrace_migration_test` name, an approved
local/Compose hostname, production configuration and an explicit reset flag.
It invokes the actual migration runner rather than the API/browser test's
baseline preparation helper. Cleanup removes only this dedicated project.
Do not run two copies simultaneously.

Expected ten PASS messages:

1. Fresh startup, full canonical ledger, repeat no-op and compiled production API/database startup.
2. Competing first startups serialize without duplicate migrations.
3. Existing snapshot upgrade preserves the customer row and historical ledger.
4. A real failure in migration 017 rolls back schema, permissions, ledger and locks from pending 011 onward.
5. Occupied ledgerless table remains untouched.
6. Occupied ledgerless view remains untouched.
7. Occupied ledgerless routine remains untouched.
8. Incomplete baseline remains refused without fabricated ledger entries.
9. Unknown historical filename remains refused without history rewriting.
10. Stale Knex lock remains respected.

The compiled API checks production configuration, liveness and database
connectivity (`/health/live`, `/health`). Storage/scanner fixture endpoints are
intentionally unavailable: this job does not claim external dependency readiness
or replace the existing storage/ClamAV integration suite.

CI runs this command in `migration-startup`. Require that check before merge
alongside the existing build, integration and browser jobs. No manually created
accounts or database reset of the ordinary app is needed.

## Failure handling and deployment

A failure should be investigated before another release. Do not delete ledger
rows, mark missing migrations as applied, run `down` functions, force-unlock, or
reset the customer database to suppress an error. Preserve the failed command
output and compare the immutable manifest with deployed files. Ambiguous legacy
history needs a backup and a reviewed reconciliation plan.

For real staging/production, migration release jobs still need a backup/restore
point and controlled promotion (ENV-011). A completed release cannot generally
be reversed by reverting application code. Atomic failure rollback is not a
replacement for backup/restore rehearsals or migration compatibility review.

## Authoring evidence

API build, 144 API unit tests, migration integrity, browser typecheck, YAML and
runner syntax checks passed. Nine nonconcurrent scenarios passed against the
real CLI/compiled API using temporary WASM PostgreSQL. No Docker runtime is
available in the authoring environment. The native PostgreSQL container test,
including concurrent first startups, must pass locally and in CI before these
backlog items are closed.
