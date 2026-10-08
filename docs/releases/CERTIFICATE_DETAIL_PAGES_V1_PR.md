# PR title

Page farm certificates and batch attestation choices without bypassing certificate access

# PR description

## Outcome

Large certificate histories no longer break the farm detail view or require a complete download to select an attestation certificate. Failed loads show retry. Farm access alone cannot reveal certificate records outside the certificate register boundary.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/CERTIFICATE_PAGES.md
- Target phase/environment: local pilot rehearsal; native candidate acceptance pending

## Change summary

- Farm detail opts into certificateMode=paged, omitting embedded certificate arrays. Add independently scoped farm certificate pages and full recorded count.
- Extend certificate totals with optional validated farmId while retaining the register relationship/read-all boundary.
- Legacy farm certificate arrays now require certificate.read and certificate relationships, with explicit overflow above 1,000 records. Narrow farm.read.all does not grant certificate visibility.
- Replace silently failed legacy attestation list reads with a paged searchable selector, retained choices and visible retry. Opening/cancelling clears hidden previous selections; transaction eligibility checks remain authoritative.
- Add three unit cases, one native 1,005-record farm/permission case and five browser definitions; retain existing certificate/trust regressions.
- Record accepted standalone certificate register release/merge/pull.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: explicit certificate read/relationship intersection, parameterized farm filter and scope-bound pages. Farm-only/cooperative access does not disclose withheld certificates. Stale selected certificates are rechecked by the existing attestation transaction. No new public/provider access or audit mutation.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only certificate reads
- Rollback or compensation: revert API/UI together; no data transformation. Reverting reintroduces broader legacy embedded disclosure.
- Configuration/secrets changed: none
- Compatibility: paged farm details return certificates:null and collection mode; legacy arrays may be unavailable or explicitly overflow. Plots remain unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 575 API units/70 files, quality, workspace/browser types, strict native-source compilation, builds and migration/backlog checks pass. Native Docker/PostgreSQL/browser execution unavailable here. Attach exact candidate SHA and release/CI evidence, then check native/browser boxes after pass. Frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named panel/search/select/paging controls. Recorded active status does not establish dates, accreditation, crop scope or attestation eligibility. Buyer/supplier trades gain no certification mandate.

## Follow-up work

- PER-001 / ARC-024: plot/batch evidence arrays, product/recall collections, exports.
- PER-003 / PER-004: hosted plans/index tuning and concurrent-load acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: standalone register accepted; this detail slice pending native acceptance. No broad completion credit.
