# PR title

Page payment workflows with scoped search and full-history counts

# PR description

## Outcome

Buyers and suppliers can search older payment workflows and browse bounded pages. Counts cover the full permitted history independently of filters. Read failures provide retry/unavailable states; each amount retains its recorded currency and precision.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/PAYMENT_PAGING.md
- Target phase/environment: local pilot rehearsal; hosted capacity remains open

## Change summary

- Add max-100 keyset payment pages with literal search, purchase/sale/status/currency filters and scope-bound cursors.
- Add independent workflow counts; open excludes settled payments and settled/cancelled contracts. No mixed-currency monetary sum.
- Extract PaymentRecordsPage with filter-reset navigation, explicit retries and accessible detail buttons.
- Refuse legacy histories above 1,000 rows explicitly. Existing payment verification, document release, dispatch and settlement rules stay unchanged.
- Add nine unit cases, four PostgreSQL definitions (1,005 workflows, production-query EXPLAIN, access denials and full counts), and four browser definitions. Record founder's accepted shipment release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: read-only tenant/party rechecks under existing deadlines; parameterized literal search. Cursors are scope-bound, not grants. No broader admin/logistics visibility, mutation-policy change or new audit/outbox action. Existing mutation transactions remain authoritative.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; existing bounded read-only snapshots
- Rollback or compensation: revert API/UI together; no data transformation
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 558 units/68 files, quality, workspace/browser types, strict native-source compilation, builds, migration integrity/backlog pass. Docker/PostgreSQL/browser unavailable here. Run verify:release on exact candidate, attach SHA/report or CI URL and check native/browser boxes after pass. Large frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named controls and keyboard-accessible record buttons; missing totals remain unavailable. Workflow counts are not confirmed funds or trade completion. Currencies are not summed together. No hosted capacity claim.

## Follow-up work

- PER-001 / ARC-024: legacy persona/control-tower aggregates, comparisons, detail collections/exports.
- PER-003 / PER-004: hosted plans and concurrent-load SLO acceptance.
- SVC work: provider service-market authorization remains separately designed; no provider grant introduced here.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: broad items remain open; this slice's native release/merge acceptance pending.
