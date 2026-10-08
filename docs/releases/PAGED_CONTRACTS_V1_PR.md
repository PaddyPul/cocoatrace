# PR title

Page contract histories and use accurate active-order dashboard totals

# PR description

## Outcome

Buyers and suppliers can search older deals and browse bounded pages. Home active-order totals exclude settled/cancelled deals and do not depend on loaded pages; the shortcut opens the latest active deal. Contract values display their recorded currency and precision.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/CONTRACT_PAGING.md
- Target phase/environment: local pilot rehearsal; hosted capacity open

## Change summary

- Add max-100 keyset contract pages with direction/status filters, literal search and tenant-bound cursors.
- Retain seller/buyer boundaries; read-all or logistics assignment cannot broaden access.
- Extract ContractRecordsPage; add explicit retries, partial counts and accessible deal navigation.
- Replace home history loading with full active totals and bounded latest-active lookup in one snapshot.
- Preserve currency/decimal precision and refuse legacy overflow; existing deal-room mutations are unchanged.
- Add nine unit cases, three native cases with 1,005 deals and five browser definitions; record accepted offers release.

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
- Evidence/results: author 540 API units/66 files, quality, workspace/browser types, strict native-source compilation, builds, migration integrity and backlog tests pass. Native Docker/PostgreSQL/browser execution unavailable here. Run verify:release on exact candidate, attach SHA/report or CI URL and mark native/browser checks after pass. Large frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named controls and keyboard-accessible deal buttons; unavailable counts remain distinct from zero. Active status does not claim dispatch/payment readiness. No hosted capacity claim.

## Follow-up work

- PER-001 / ARC-024: shipment/payment pages, legacy persona/control-tower aggregates, comparisons, detail collections and exports.
- PER-003 / PER-004: hosted plans and concurrent-load SLO validation.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: broad items remain open after this slice; native release/merge pending.
