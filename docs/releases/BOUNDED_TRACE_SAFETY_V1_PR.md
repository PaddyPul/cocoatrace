# PR title

Bound trace analysis and preserve atomic recall containment

# PR description

## Outcome

Trace and recall calculations no longer load the whole network or recurse through unbounded genealogy. Oversized, cyclic, malformed or timed-out analysis returns an explicit incomplete result without safety clearance or partial scope. Small unrelated components remain usable. Failed activation rolls back notice, scope and holds; successful activation retains full commingled-descendant containment.

## Tracking

- Backlog ID(s): PER-002; limited contribution to PER-001/ARC-024. Acknowledge accepted PRD-004 and partial source/evidence coverage.
- Issue/ADR: docs/runbooks/BOUNDED_TRACE_SAFETY.md; docs/performance/TRACE_BOUNDS_2026-10-07.md
- Target phase/environment: core pre-pilot safety, local/CI correctness; hosted capacity pending.

## Change summary

- Discover only the authorized seeds' full connected component, including co-inputs needed for mass allocation.
- Bound nodes, edges, distributions, seeds, depth, work, elapsed time and PostgreSQL statements; fetch limit+1 and reject overflow.
- Use read-only repeatable-read snapshots and targeted seed authorization; bound the permitted lot selector without loading genealogy.
- Replace recursive cycle detection, queue shifts, high-copy adjacency and repeated distribution/recipient scans.
- Write affected lot scope and holds in bulk within the existing activation transaction, retaining holding holds, listing withdrawal, participants, outbox and audit.
- Return typed incomplete metadata and keep the UI from showing stale/partial results.
- Add adversarial/capacity unit tests, repository cancellation/rollback tests, native PostgreSQL isolation/atomicity cases and browser error presentation coverage.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Foreign seeds are denied before graph discovery. Trace permission remains the existing connected-seed policy; this change does not create network-wide access. Limits are not user-controlled. No incomplete scope is published or committed. Failure does not automatically create new holds: suspect material requires physical isolation, a trade stop and operator escalation. Successful computation is not a safety certification.

## Database and deployment

- Migration required: no
- Backfill/lock implications: reuse existing genealogy indexes and recall boundary lock; transaction-local SQL timeout, no global setting change. Atomic bulk writes replace per-lot round trips.
- Rollback or compensation: previous application images; no schema/data compensation. Existing recalls remain valid.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author API units (437), quality, workspace/browser types, native integration-file compilation, API/web builds, migration integrity and backlog checks passed. Synthetic calculation rehearsal: 2,000 lots / 1,999 edges / 8,000 distributions, ten runs, median 13.56 ms, max 35.80 ms. This is not hosted capacity evidence. Docker and Chromium are unavailable here; native regression execution must pass `npm run verify:release` on the candidate SHA before merge. Update native boxes and attach the report/CI URL after that pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Explicit alert, accessible trace inputs and cleared stale results. Existing structured logging/correlation remains. Full accessibility review and production monitoring remain separate.

## Follow-up work

- PER-001 / ARC-024: paginated/searchable large lot selectors and API-wide bounded list/export queries.
- PER-003 / PER-004: hosted concurrent load, query-plan, memory and event-loop measurements.
- OPS / SAF: operational isolation/escalation drills and capacity review before raising policy limits.
- PRD-003 / PRD-005 / QLT-009: request-specific evidence checklist and reopening/editing saved sourcing briefs.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

PER-002 completion awaits native acceptance and merge acknowledgement; general pagination and hosted capacity do not receive completion credit.
