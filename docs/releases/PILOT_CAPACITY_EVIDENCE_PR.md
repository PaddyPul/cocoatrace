# PR title

test: measure local pilot HTTP capacity and enforce resource budgets

# PR body

## Outcome

Release acceptance now records a reproducible local PostgreSQL/HTTP capacity baseline for marketplace, trade writes/actions, provenance, trace and mixed workloads. A checked capacity policy distinguishes32 existing resource defaults/ceilings from measured performance.

## Tracking

- Backlog ID(s): PER-004, QLT-016, OPS-014 closure targets; accepted QLT-010/012/014 reconciled.
- Issue/ADR: docs/performance/PILOT_LOAD.md and CAPACITY_BUDGETS.md.
- Target phase/environment: Phase1/2 local single-process capacity baseline; hosted combined-worker/customer-volume acceptance remains separate.

## Change summary

- Execute six real loopback HTTP workloads with100 measured requests each at concurrency4, including150 real offer writes. No discarded warm-up, ignored failures or retries.
- Seed1,005listings,100provenance metadata rows and a200lot/199edge graph; independently verify page scope, actionable offer decisions, provenance completeness state, trace quantities and exact offer/audit/inventory invariants.
- Record current Git SHA, host/data context, concurrency, sample counts, nearest-rank p50/p95/p99/max, error counts and invariant outcomes in a bounded sanitized report.
- Reject missing/stale/over-budget evidence. Invalidate prior output before native integration; check fresh output after and archive CI summaries for30days.
- Source-check32 database/storage/upload/scanner/trace defaults and ceilings without importing runtime configuration or executing expressions. Declare provisional p95≤2s/p99≤5s regression targets separately from results.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Dedicated disposable database guard, verified fixture roles and loopback-only ephemeral server. Real offer writes must produce150audit events, zero contracts and unchanged stock. Reports omit credentials, request/response bodies, URLs, IDs and SQL. Existing production deadlines/limits and native concurrency suites remain unchanged. Provenance uses synthetic metadata, not scanned file bytes or external storage throughput.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None. Workload setup/mutations are confined to the disposable native suite.
- Rollback or compensation: Revert test/gate changes if required; no production data migration or compensation.
- Configuration/secrets changed: No deployed configuration or secrets. Existing defaults/limits are inventoried, not raised. Dependencies unchanged; two npm report-check/contract commands added.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1423 API unit tests, workspace API/web/browser types, strict compilation of the native load suite, quality, API/web builds, report contracts3 and release-runner17 passed.222-route register, pilot evidence/backlog/risk/branding and migration integrity passed. No runtime throughput/latency result exists on this author host. Exact-commit Docker/native load report, full release and required CI remain pending; update with actual report SHA/date and observed p95/p99 after execution. Existing browser gates remain mandatory; no new UI scenario is claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Observed local timing is not a customer SLA or hosted capacity guarantee. Host memory/CPU count is not Docker allocation. The200node star is below the2,000lot ceiling; no max-depth/size claim. Pending-offer writes do not test acceptance/settlement races. Retain counts-only reports beyond CI's30day expiry if needed for due diligence.

## Follow-up work

- CORE-performance/PER-005/006/007: Representative hosted combined loads, mobile/accessibility, multi-instance/crash behavior and streaming efficiency.
- OPS-001/011/012: Managed infrastructure, deployed metrics and agreed operational SLO/RPO/RTO.
- GEO-001: Actual first-pilot commodity, corridor and named customer-volume agreement.
- SEC-018: Independent review remains required; load tests do not prove universal authorization.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted148/343 (43.1%); three targets yield151/343 (44.0%) after recorded local workload/full release/review/merge. Core11/28 and provider-inclusive11/40 unchanged. Completion does not imply valuation or hosted pilot readiness.
