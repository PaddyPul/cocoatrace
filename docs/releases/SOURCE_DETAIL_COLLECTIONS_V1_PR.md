# PR title

Page farm plots and batch evidence with scoped totals and explicit retry

# PR description

## Outcome

Large plot and evidence histories no longer require complete embedded downloads to open farm and batch details. Users can search and navigate pages while seeing full recorded totals. Batch read access alone cannot reveal evidence metadata.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/SOURCE_DETAIL_COLLECTIONS.md
- Target phase/environment: local pilot rehearsal; native candidate acceptance pending

## Change summary

- Add farm plot pages and full totals with live farm relationship authorization, literal search and scope-bound cursors.
- Add evidence totals using the existing evidence visibility policy; replace batch embedded metadata with paged reads requiring evidence.read.
- Opt farm and batch details into paged collection modes; legacy collections explicitly reject overflow above 1,000 records.
- Extract FarmPlots, BatchEvidence and a keyed count hook; distinguish unavailable/error states from empty results and preserve creation/attestation actions.
- Add six unit cases, four native database definitions and five browser definitions; record accepted certificate detail release/merge/pull.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: shared relationship checks, safe evidence projection, parameterized filters, bounded reads and current authorization on cursor follow-up. Metadata access does not grant file-byte/download access. No audit/outbox mutation introduced.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only catalog transactions
- Rollback or compensation: revert API/UI together; no data transformation. Reverting restores unbounded embedded plot/evidence paths.
- Configuration/secrets changed: none
- Compatibility: paged details return null collections plus mode fields; legacy overflow returns 422. Missing evidence.read yields unavailable metadata.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 581 API units/71 files, quality, workspace/browser types, strict native-source compilation and builds pass. Docker/PostgreSQL/browser execution unavailable here. Attach exact tested candidate SHA and release/CI results, then check native/browser boxes after pass. Frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named regions/search/paging controls; recorded totals are not certification, evidence approval or malware clearance. Buyers/suppliers acquire no certification mandate.

## Follow-up work

- PER-001 / ARC-024: remaining embedded product/recall collections, batch plot-ID/trust payload bounds and exports.
- PER-003 / PER-004: hosted plans/index tuning and concurrent-load acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: certificate detail slice accepted; this plot/evidence slice pending native acceptance. No broad completion credit.
