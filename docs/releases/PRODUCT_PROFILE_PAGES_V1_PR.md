# PR title

Page product registers with scoped totals and accurate recall-hold presentation

# PR description

## Outcome

Users can search and navigate large product registers without loading every passport. Totals cover the complete authorized register. A resolved recall with a retained hold remains visible, and evidence counts describe recorded metadata rather than claiming approval.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/PRODUCT_PROFILE_PAGES.md
- Target phase/environment: local pilot rehearsal; native candidate acceptance pending

## Change summary

- Add max-100 product pages, literal server search, visibility/attention filters and scope-bound cursors under the existing product party policy.
- Reuse full scoped workspace product totals; remove metrics computed from a complete downloaded array.
- Materialize limited candidates before scan/evidence counts and bound trust decoration to the returned page. Legacy register explicitly rejects overflow above 1,000.
- Preserve active severity and retained inventory holds; distinguish missing origin and recorded evidence from verified claims.
- Add seven unit cases, three database definitions and five browser definitions; record accepted farm plot/batch evidence release.
- Give the existing migration integrity fixture/process tests local 30-second bounds and checker subprocesses a 15-second cap with explicit errors. Hash and tampering assertions remain unchanged; global test timeouts are unchanged.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: batch.read plus existing productScope, explicit product_profile.read.all only, literal parameterized search and current scope on every read. Public publication does not grant unrelated tenant register access. No new file-byte access, mutation, audit or outbox path.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only transactions
- Rollback or compensation: revert API/UI together; no data transformation. Reverting restores full-list reads and older hold/approval presentation.
- Configuration/secrets changed: none
- Compatibility: legacy register capped at 1,000; evidence_count denotes recorded metadata; register order is UUID, not update timestamp.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 588 API units/72 files, quality, workspace/browser types, strict native-source compilation and builds pass. Docker/PostgreSQL/browser execution unavailable in author environment. Attach exact tested candidate SHA and release/CI results before checking native/browser boxes. Frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named search/paging/retry; totals remain unavailable on failure. Recorded evidence is not approval; no recorded hold is not a safety certificate. Direct-inventory location fallback is recorded supplier data.

## Follow-up work

- PER-001 / ARC-024: public product detail histories, recall collections and exports.
- PER-003 / PER-004: representative hosted plans/index tuning and concurrent-load acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: source detail slice accepted; this product register slice pending native acceptance. No broad completion credit.
