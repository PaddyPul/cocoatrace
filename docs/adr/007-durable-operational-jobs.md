# ADR 007 — Database-owned background work and bounded recovery

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review accepted on 2026-10-15 with the pilot-integrity release. This status does not assert hosted deployment or independent security acceptance.

## Context

Reminder delivery, recall notifications and evidence cleanup must survive restarts and expose terminal failure without duplicating business changes or blocking all work behind a slow scanner.

## Decision

Use durable database work/outbox records with bounded batches, retry state and audited recovery. Operations job loops have independent scheduling and database lock ownership; dedicated lock connections avoid consuming the request/domain pool for ownership. Keep SMTP-dependent jobs explicitly skipped when delivery is disabled. Operator alerts are opt-in and use their own delivery state. Business transaction success means durable work was recorded where that workflow uses an outbox, not that a recipient received email.

## Alternatives and rationale

Request-only fire-and-forget work loses failures across process exits. In-memory queues do not survive restarts. An external broker could improve throughput but adds hosting and operational dependencies before the current bounded workloads justify it.

## Consequences, validation and change control

Delivery is not an exactly-once external side effect: retry and provider uncertainty require idempotency and operator visibility. Current outbox coverage is workflow-specific, not universal. Terminal work needs reviewed recovery rather than blind replay. Hosted scheduler ownership, actual inbox receipt and independent monitoring remain separate acceptance. A future broker must preserve durable states, audit links and retry semantics.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [api/src/modules/operations/worker.ts](../../api/src/modules/operations/worker.ts)
- [api/src/modules/operations/jobs.ts](../../api/src/modules/operations/jobs.ts)
- [api/src/modules/operations/recovery.ts](../../api/src/modules/operations/recovery.ts)
- [api/src/modules/payments/reminders.ts](../../api/src/modules/payments/reminders.ts)
- [docs/runbooks/OPERATIONS_JOBS.md](../../docs/runbooks/OPERATIONS_JOBS.md)
- [api/test/integration/operationsWorkers.integration.test.ts](../../api/test/integration/operationsWorkers.integration.test.ts)
