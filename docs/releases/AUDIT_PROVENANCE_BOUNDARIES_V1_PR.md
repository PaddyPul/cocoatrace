# PR title

Bound audit history browsing and complete provenance reports

# Replacement PR description

## Outcome

Audit history remains searchable beyond the first page without exposing unrelated organizations or presenting failed reads as empty history. Provenance reports are complete within explicit resource limits; oversized reports fail instead of silently omitting evidence.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — focused slices; broad items remain IN PROGRESS. ARC-010 shared-builder candidate awaits acceptance.
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/AUDIT_RECORD_PAGES.md; docs/runbooks/PROVENANCE_PACK_BOUNDS.md
- Target phase/environment: pre-pilot; local release candidate, then staging

## Change summary

- Add authorized audit pages, scoped cursors, server-side literal search and independent full totals.
- Extract the audit workspace into a dedicated component with explicit read errors/retry and navigation.
- Add organization/global audit chronology indexes for keyset reads.
- Share a bounded authorized provenance builder between view/export, with complete report byte limits.
- Preserve independent batch/contract and read/export network permission checks and durable export attribution.
- Count only validated, clean supporting documents in completeness in both view and export; unsafe evidence metadata remains visible without counting as support.
- Record founder acceptance of public safety and audit export boundaries.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: explicit audit.read.all and provenance network permissions remain separate. Cursors bind tenant/filters; bounded read snapshots retain existing deadlines. No storage keys, signed document links or recipient contacts added to list/report projections. Export attribution must succeed before download.

## Database and deployment

- Migration required: yes — 034_audit_register_indexes.ts
- Backfill/lock implications: no data backfill; ordinary chronology index creation locks audit writes during migration. Pre-pilot rollout; large live tables require a reviewed concurrent-index plan.
- Rollback or compensation: revert API/UI together; indexes may remain safely or be removed through a reviewed migration; no data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 676 API unit assertions pass; quality, types, builds, migration integrity, backlog checks and strict native-source compilation pass. Fourteen PostgreSQL and three browser regression cases are defined. Native Docker/PostgreSQL/browser execution unavailable author-side. Tick integration/E2E only after exact-candidate npm run verify:release passes; append SHA/report evidence. Required GitHub CI must pass before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named audit region and explicit search/navigation/retry. Empty filters do not assert an empty organization history; report completeness does not assert independent legal/regulatory compliance.

## Follow-up work

- PER-001 / ARC-024: remaining embedded collection and legacy caller boundaries.
- PER-003 / PER-004: hosted query-plan and representative concurrent-load acceptance.
- Public field consent/redaction and pilot operational acceptance remain open.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate completion awaits exact release and founder merge/pull acceptance; broad items remain open.
