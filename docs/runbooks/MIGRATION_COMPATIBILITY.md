# Migration compatibility and rollback rules

Tracks ENV-012. This is the reviewed release policy for schema changes, not a claim that rolling deployment is provisioned or supported by the current Compose stack. The release owner records the compatibility decision in each schema-changing PR and release manifest.

## Current mechanism and its limits

The API image starts with `node --import tsx api/scripts/migrate.ts` before `node api/dist/server.js`. The runner verifies immutable migration assets, validates the complete migration-name ledger and applies pending forwards in one transaction under a PostgreSQL advisory lock. It refuses unknown, missing or gapped history and migrations that disable transactions. See [migration startup](MIGRATION_STARTUP.md) and [migration integrity](../MIGRATION_INTEGRITY.md).

This serializes competing migration callers; it does not coordinate existing API traffic or workers, drain requests, prevent a long table lock, or prove that an older binary can read the changed schema. The 120-second lock wait is a runner lock bound, not a customer latency objective or a complete migration execution deadline. A transaction can roll back a failed invocation; it cannot undo a successfully deployed release and its subsequent customer writes.

**An older image's default startup can refuse the newer ledger**, even when its application code is compatible: the older artifact does not know newly applied migration filenames. Therefore “redeploy the previous image” is not a complete rollback procedure. Never delete ledger entries or copy new migration files into an immutable old image to bypass that refusal.

## Compatibility classification

Before promotion, record the old and new image digests, schema/migration identifiers, active browser/API consumers, worker versions and this classification:

| Class | Examples and required decision |
| --- | --- |
| Expand | Add nullable columns or new tables with compatible permissions. Prove old readers/writers and new code tolerate the change; an additive change can still acquire locks or break positional reads. |
| Transition | Backfill a replacement representation, dual-read or dual-write. Define conflict precedence, retry/idempotency, tenant scope, progress checkpoints and the reconciliation query before executing. |
| Contract | Drop/rename columns, enforce new constraints, change types or remove statuses. Stop old readers and writers first; require accepted migration evidence and an explicit maintenance release unless mixed-version compatibility is demonstrated. |
| Exceptional | Nontransactional index work, large rewrites or provider-specific DDL. The normal runner refuses nontransactional migration configuration. Design a separate reviewed execution/recovery mechanism; do not disable this guard as a deployment shortcut. |

Never alter frozen or registered migrations. Add a forward migration and register its digest. Use the [release and compatibility policy](../governance/RELEASE_AND_COMPATIBILITY_POLICY.md) for consumer notices, in-flight trades and security exceptions. Compatibility never permits cross-tenant access or restores revoked authority.

## Expand, transition, contract sequence

1. **Expand release:** add the new representation while preserving the old contract. New required values need a safe staged population strategy; do not silently invent provenance, commercial terms, safety status or ownership. Exercise the previous application against the expanded schema.
2. **Transition release:** deploy code that handles both representations. Run separately bounded, resumable, organization-scoped backfill batches with stable checkpoints. Record counts and exception handling; reconcile old/new values and concurrent writes. Avoid placing a large backfill inside the all-pending-migrations transaction.
3. **Observation period:** verify no remaining old consumers, old jobs or old writers. Record accepted evidence and the rollback window; elapsed time alone does not prove compatibility.
4. **Contract release:** remove old representation only after the release owner accepts migration and consumer evidence. Update the minimum compatible application version and recovery plan. A contract migration normally ends the ability to roll back to older code without data recovery.

No fixed number of releases makes an unsafe change safe. Keep the old representation until its actual dependants have migrated.

## Rehearsal and promotion checklist

- Restore a representative sanitized backup into an isolated database. Preserve the original; never rehearse first on the only customer database.
- Record the current ledger, schema size, important row counts and the candidate migration names. Verify frozen inputs and run `npm run test:migrations:docker`; the API integration suite alone is not an upgrade rehearsal.
- Apply the candidate using its exact immutable artifact. Repeat the command to verify a no-op. Record duration, blocked-query/lock behavior, resources and the approved stop/maintenance threshold. Give a named operator permission to stop the rollout; do not guess database cancellation commands during an incident.
- Test old and new API **and worker** behavior against the resulting schema: reads, authorized/denied tenant mutations, retries, concurrent transitions, pending outbox work and critical payment/recall paths. Test the proposed rollback launch mode as well as the new startup mode.
- Verify backfill checkpoints and invariants, evidence metadata/object consistency, successful readiness and the restored recovery target. Record failures as blockers, not warnings to bypass.
- Promote only the rehearsed digests with a current backup/PITR reference, named release and database recovery owners, a declared maintenance or mixed-version strategy, and explicit rollback criteria.

## Rolling deployment prerequisites

Current local Compose startup is not evidence for these conditions. Before enabling a rolling rollout, the selected provider must support controlled traffic promotion, readiness checks, connection/request draining, separate migration execution, controlled API/worker versions, observability and recovery access. Migration execution should be a single attributable release job; serving instances must not race to decide schema promotion. Changing startup responsibilities requires implementation and testing, not a command in this policy.

Mixed old/new traffic is permitted only with demonstrated bidirectional schema and job compatibility. The old-image ledger refusal must also have a reviewed solution. A separately controlled serve-only launch may be considered for a known compatible artifact, but it requires deployment implementation, permission controls, ledger verification and rehearsal before use. This document does not add a supported migration-skip configuration or authorize bypassing the default startup checks.

If the provider cannot satisfy these controls, use a declared maintenance window: stop writes and workers, drain traffic, take/verify the recovery point, migrate, deploy and smoke-test, then resume. A free hosting tier does not waive these requirements. See [staging preparation](STAGING_PREPARATION.md) and [deployment diagnostics](DEPLOYMENT_DIAGNOSTICS.md) for environment-specific evidence still required.

## Recovery decision

| Situation | Action |
| --- | --- |
| Migration failed before transaction commit | Preserve sanitized logs and verify transaction/ledger state. Fix the cause or ship a new forward migration; do not mark pending migrations applied. |
| Migration committed; old application and its launch mode proven compatible | Use the rehearsed immutable rollback artifact and deployment procedure. Retain the forward schema and ledger; do not run `down`. |
| Compatibility or old-image startup unknown | Keep traffic restricted and choose a reviewed forward fix or recovery plan. An incident is not a time to infer compatibility from additive DDL. |
| Data corruption or incompatible schema requires restore | Stop API writes and workers, preserve incident evidence, and restore the approved database recovery point into a separate recovery target first. Reconcile evidence objects, outboxes and external side effects before cutover. Explicitly account for writes after the recovery point; restoration may lose them and cannot undo email, payment or logistics side effects. |

Follow the [deployment rollback runbook](EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md#deployment-rollback) for incident ownership, readiness and smoke tests. Record exact artifacts, migration state, restore-point reference, affected writes/side effects, recovery timing, approval and follow-up work. Never reset, seed, force-unlock or rewrite customer migration history to make a release green.

## Acceptance record

A schema-changing release is ready only when its PR links the classification, upgrade and old/new compatibility evidence, lock/backfill implications, deployment mode, minimum compatible rollback artifact and rehearsed recovery instructions. ENV-012 policy publication does not complete hosted migration-job, rolling deployment, backup/PITR or provider recovery work; those need deployment-specific evidence.
