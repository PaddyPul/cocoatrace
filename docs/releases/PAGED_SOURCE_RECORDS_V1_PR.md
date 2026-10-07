# PR title

Page farm and batch records while preserving source selection and full totals

# PR description

## Outcome

Suppliers can find older source farms and batches beyond the first page. Harvest and certificate selectors keep their chosen farm across pages. Farm batch totals and home source-setup guidance use full authorized aggregates instead of partial lists.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — remain IN PROGRESS.
- Issue/ADR: `docs/runbooks/SOURCE_RECORD_PAGINATION.md`
- Target phase/environment: local pilot rehearsal; hosted load acceptance remains open.

## Change summary

- Add bounded farm/batch pages with server search/filtering, scoped cursors and current relationship/read-all policies.
- Add full authorized farm and recorded-batch aggregates; enrich visible batch rows using authoritative trust assessment.
- Extract farm/batch pages from DataPages, with stable search controls, page navigation, retry and clear page counts.
- Introduce paged harvest/certificate farm selection with retained selection; filter farm-detail batch history on the server.
- Cap legacy arrays explicitly; record founder acceptance of the previous transfer wave.
- Add SQL, native large-workspace/relationship and browser navigation/selector regressions; update home fixture for farm totals.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: keep existing farm/batch list relationships; explicit read-all remains privileged breadth. Cursors bind to live read scope but never authorize resources. Owner-only selection narrows reads; mutation authorization unchanged. SQL parameters are typed/bounded, search is literal and proof reads refuse overflow. Read-only operations add no audit/outbox changes. Existing file-upload authorization and scanning are unchanged.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only snapshots and existing catalog deadlines.
- Rollback or compensation: revert API/web together; no business data transformation.
- Configuration/secrets changed: none; dependencies unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author checks pass: 482 API unit tests/62 files, quality (10 policy tests), workspace/browser type checks, strict native test-source compilation, builds, migration integrity and backlog validation. Author environment has no native Docker/PostgreSQL/browser runtime. Before merge run npm run verify:release, check native integration/browser boxes only after success, and record the exact candidate SHA/report or CI evidence. Added native cases use 1,005 farms/batches and cover relationship isolation, cursor scope, filters, aggregates and overflow. No hosted capacity evidence claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: existing redacted logging retained. Named search/select/page controls and retry states included; native browser verification pending. Recorded source quantity is explicitly distinct from available physical inventory. Existing large web chunk warning remains open performance debt.

## Follow-up work

- PER-001 / ARC-024: migrate remaining legacy dashboard/evidence/control-tower consumers and other lists/exports; bound remaining detail collections.
- PER-001 / PER-003 / PER-004: hosted query plans, indexes and representative concurrent-load SLO acceptance.
- Existing security/operations/pilot approval and logistics-provider marketplace remain separate gates.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: source-record slice remains native-release pending until tested and merged. Broader paging/performance items remain open afterward.
