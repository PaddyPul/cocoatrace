# PR title

Bound public reviewed evidence and recheck publication

# Replacement PR description

## Outcome

Visitors can page/search reviewed evidence on published product profiles without loading complete metadata histories. Public proof uses current review and malware/validation state, so older approval cannot override a newer revocation. Recall warnings remain separate from evidence paging.

## Tracking

- Backlog ID(s): PER-001, ARC-024 (focused slice; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/PUBLIC_EVIDENCE_PAGES.md
- Target phase/environment: pre-pilot; local release candidate, then staging

## Change summary

- Add published-profile evidence pages capped at 100 records, literal search and complete eligible totals.
- Replace the profile’s complete evidence array with a 50-row first page and explicit `evidencePaging` metadata.
- Require latest independent unexpired review, validated evidence and clean scan; recheck publication on every page.
- Add proof search/navigation and fail-closed retry; label general profile errors unavailable rather than not found.
- Record accepted recall-response release and leave public journey/notice histories and exports open.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: only published-profile batch evidence is eligible. Cursor binds profile/batch/search. Minimal metadata projection has no uploader/storage/token/file bytes. Latest revoked/expired/self review is excluded. Reads are repeatable-read with existing deadlines, `no-store` and shared public abuse limits. No audit/outbox write or download-policy change.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; catalog read-only transactions
- Rollback or compensation: revert this application commit; no data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 618 API unit assertions passed; quality, workspace/browser types and production builds passed. Six PostgreSQL and three browser cases added. After exact-candidate `npm run verify:release` passes, check integration/E2E boxes and append commit/report evidence. Required GitHub CI must pass before merge. Native execution is pending at author delivery.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named proof region and exact navigation labels added; browser verification remains pending. Existing redacted diagnostics retained. Empty proof never implies safe material or clearance of an inventory hold.

## Follow-up work

- PER-001 / ARC-024: public journey and notice histories, remaining exports, hosted load/query-plan acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- This candidate is not complete until exact-commit release and founder merge/pull acceptance. Broad items remain open beyond this slice.
