# PR title

Bound evidence-library reads with authorized paging and server search

# PR description

## Outcome

Organizations can find older evidence beyond the first page without loading the entire library. Record-scoped views check the existing relationship policy on each page, and failed reads show retry instead of an empty library. Document review and scan states remain distinct; protected downloads keep their separate payment and malware gates.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — remain IN PROGRESS.
- Issue/ADR: `docs/runbooks/EVIDENCE_PAGINATION.md`
- Target phase/environment: local pilot rehearsal; hosted capacity acceptance pending.

## Change summary

- Add max-100-row evidence metadata pages with literal server search, entity filters and organization/search/read-scope cursors.
- Reuse existing relationship predicates with an optional transaction executor, so scoped authorization and metadata reads share a bounded snapshot.
- Preserve metadata-only projections; explicitly reject legacy list overflow beyond 1,000.
- Extract the evidence library from DataPages with page counts, navigation, scoped URLs, retry and distinct review/scan states.
- Add unit, native large-library and browser regressions; record founder acceptance of source-record paging.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: general library remains uploader-scoped or explicit evidence.read.all. Entity views retain existing relationship policy and recheck within a read-only snapshot; cursors never authorize access. Typed parameters, literal search, query deadlines and row limits apply. Storage locators/signatures and uploader identity stay out of metadata. Downloads, upload limits, malware and payment-release checks unchanged. Read-only changes add no mutation/audit/outbox work.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only snapshots only.
- Rollback or compensation: revert API/web together; no business data transformation.
- Configuration/secrets changed: none; no dependency changes.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passes 500 API unit tests/63 files, quality (10 policy tests), API/web/browser type checks, strict native test-source compilation and API/web builds. Four native cases use 1,005 evidence rows: paging/search, safe metadata, shared-record access vs uploader scope, foreign denial, clean-scan gate, relationship revocation, cursor scope and live permission narrowing. Four browser cases cover pages/search/status, entity scope, retry and malformed responses. Docker/PostgreSQL/browser execution unavailable author-side. Before merge run `npm run verify:release`, check native/API/browser boxes only after success and attach exact tested SHA/report or CI URL.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: existing redacted logging retained. Named search/page/retry controls included; native browser acceptance pending. Counts represent page rows. Scanning does not certify a claim; metadata visibility does not release a protected document. Existing web chunk warning remains open performance debt.

## Follow-up work

- PER-001 / ARC-024: evidence-contribution record selectors, control-tower aggregates, embedded detail arrays and remaining list/export consumers.
- PER-001 / PER-003 / PER-004: hosted query plans/index tuning and representative concurrent-load SLO acceptance.
- Existing pilot security/operations and logistics-provider marketplace remain separate gates.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: exact-candidate native release and merge acceptance pending for this slice. Universal paging and hosted-performance work stays open afterward.
