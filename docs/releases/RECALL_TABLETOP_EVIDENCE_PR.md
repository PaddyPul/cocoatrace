# PR title

test: record recall tabletop completeness and containment evidence

# PR body

## Outcome

Three disposable native recall tabletops check exact recipient identification and physical containment for partial stock, commingled genealogy and distributed material. Release/CI now require a fresh, current-commit drill report instead of relying on an unrecorded scenario pass.

## Tracking

- Backlog ID(s): RCL-008, RCL-013, INV-010 closure targets; accepted ARC-008/RCL-010 reconciled.
- Issue/ADR: docs/runbooks/RECALL_TABLETOP_DRILLS.md.
- Target phase/environment: synthetic disposable native recall readiness; live customer/hosted response acceptance remains separate.

## Change summary

- Declare expected recipients independently of production registration queries; assert exact organization sets, unrelated-tenant exclusion, stock holds, listing withdrawal and unchanged quantities/ownership through actual recall activation.
- Reconcile non-overlapping current physical stock plus outward distributions in integer grams. A 4kg suspect input into a 10kg blend contains the entire output without counting consumed source inventory twice.
- Keep an inactive distribution contact in the participant set with explicit escalation; verify only active contacts receive queued work. No delivery worker runs and no inbox receipt is inferred.
- Write a counts-only report with current Git SHA, timings, graph completeness, unresolved acknowledgement/contact counts and physical reconciliation. Failed/missing/duplicate scenarios cannot pass validation.
- Invalidate prior evidence before release/CI integration, validate the new report afterward, and archive CI reports for 30 days. Reject malformed, oversized, foreign-commit and extra-field reports.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No production permission/endpoint/workflow change. Disposable database guard and explicit verified actor roles remain required. Reports omit contact data, resource identifiers, file/storage keys and proof bytes. Existing activation lock/audit/outbox semantics are exercised; no external email dispatch or live customer record is involved. Same-commit stale summaries are removed before integration; a prior report cannot substitute for a new run.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None. Native fixtures use existing schema and real activation locks; test setup inserts genealogy/accepted-contract state and does not claim a customer transformation or acceptance workflow.
- Rollback or compensation: Revert code/gate changes if necessary; no production data migration.
- Configuration/secrets changed: None; dependencies unchanged. Two npm commands added for report contracts/validation; generated reports are ignored by Git.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1400 API unit tests, workspace API/web/browser types, strict compilation of3 affected native suites, report contracts3 and release-runner16 tests passed. Quality, API/web builds,222-route register, pilot evidence/backlog/risk/branding and migration integrity passed. Exact-commit Docker/native/browser/stress/full release and required CI remain pending. Update this entry with the recorded passing SHA/date; compilation is not native runtime acceptance. No new UI journey is claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No rendered UI change. Report timing is observed local test execution, not a hosted SLO. Complete graph/recipient identification does not imply safety clearance, physical recovery completion, recipient acknowledgement or email delivery. CI retains the sanitized report for 30 days; retain it with release evidence before expiry.

## Follow-up work

- RCL-003/004/005: External recipient delivery, acknowledgement deadlines and physical segregation/write-off policies.
- INV-009: Repeated real pilot workflows and independent buyer review.
- PER-004/OPS-012: Representative hosted capacity, SLOs and operational recovery targets.
- OPS-007/008/015: Named incident ownership and exercised customer communication/response procedures.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted142/343 (41.4%); three targets yield145/343 (42.3%) after actual drill/report/release/review/merge. Core11/28 and provider-inclusive11/40 unchanged. Completion is not a valuation or launch-readiness score.
