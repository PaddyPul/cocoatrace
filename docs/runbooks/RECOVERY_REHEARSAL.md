# PostgreSQL recovery rehearsal

## Purpose

This rehearsal proves that CocoaTrace can create a PostgreSQL custom-format backup and restore it into a separate, fresh database while preserving:

- the fully forward-migrated schema;
- the exact Knex migration history;
- related organization, user, farm and inventory records;
- private-evidence metadata; and
- audit history.

It is a destructive test only inside the fixed `cocoatrace-recovery-tests` Docker Compose project. It does not connect to, inspect or back up development, staging, production or customer databases.

## Run

Docker Desktop with Compose v2 must be running. From the repository root:

```powershell
npm run test:recovery:docker
```

The runner uses `docker compose up --wait`, which is compatible with the older Docker Desktop versions used by the other CocoaTrace test runners. If port `15436` is already occupied, select another non-privileged port:

```powershell
$env:COCOATRACE_RECOVERY_DB_PORT="15446"
npm run test:recovery:docker
Remove-Item Env:COCOATRACE_RECOVERY_DB_PORT
```

Success ends with:

```text
PASS: forward-migrated schema, migration history, linked fixtures, evidence metadata and audit history restored into a separate fresh database
```

The runner always attempts `docker compose -p cocoatrace-recovery-tests down --volumes --remove-orphans`, including after a failed startup or assertion. Its PostgreSQL data directory is a disposable `tmpfs`, and the backup archive exists only inside that disposable container.

## What the rehearsal does

1. Cleans only the dedicated `cocoatrace-recovery-tests` Compose project.
2. Starts PostgreSQL 16 with the fixed source database `cocoatrace_recovery_source`.
3. Builds the normal API image and applies the repository's verified forward migrations.
4. Confirms the migration ledger exactly matches the migration files on disk.
5. Inserts records named `RECOVERY REHEARSAL ONLY` across related business tables. These are synthetic test records, never customer data.
6. Creates a `pg_dump --format=custom` archive without ownership or privilege statements.
7. Creates the separate, empty database `cocoatrace_recovery_restored` and restores with `pg_restore --exit-on-error`.
8. Verifies migration history, a public-schema fingerprint, relational fixtures, evidence metadata and audit metadata in the restored database.
9. Removes only the dedicated test project and its disposable data.

## Failure handling

A non-zero exit means the rehearsal did not prove recovery. Do not describe backups as restore-tested until the failure is resolved and the command passes again. Preserve the terminal output in the operational evidence record; the runner does not retain the database or archive after cleanup.

Common causes include Docker Desktop not running, the configured port already being occupied, migration-integrity failure, insufficient disk space for the temporary image/archive, or a PostgreSQL dump/restore error.

## Production and staging procedure

This local rehearsal is a prerequisite, not the production recovery process. After a hosting provider is chosen, document and test separately:

- provider-managed encrypted backup and point-in-time-recovery configuration;
- retention periods, backup region/account isolation and access controls;
- restoration into an isolated staging recovery environment;
- credential rotation and application reconnection after restore;
- measured recovery point objective (RPO) and recovery time objective (RTO);
- evidence object-store versioning, retention and object restoration; and
- reconciliation between restored PostgreSQL evidence metadata and restored private object bytes.

## Explicit limitations

- The fixture includes evidence metadata only. It deliberately creates no file or private object-storage bytes.
- It does not validate S3-compatible bucket backup/version recovery, malware-scanner state, email delivery, DNS, secrets or application containers after a provider restore.
- It does not validate a cloud provider's automated backup schedule or point-in-time recovery.
- It is not authorized to accept a database URL and cannot be repointed at customer data.
- A successful local result does not close `OPS-001` or `OPS-002`; those require the selected provider's managed backup configuration and a recorded isolated restore drill.
