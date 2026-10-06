# PR title

Make supplier setup and evidence contribution record-aware

# PR description

## Outcome

A new supplier can choose conventional inventory without creating a farm, or register a farm and plots before recording harvest. Evidence contribution starts with an accessible record and document purpose; users no longer need to paste a UUID or guess what an empty document screen expects. Sourcing navigation no longer claims to save unsaved changes.

## Tracking

- Backlog ID(s): PRD-003, PRD-004, QLT-009; acknowledge completed PRD-006.
- Issue/ADR: docs/runbooks/SOURCE_EVIDENCE_ENTRY.md
- Target phase/environment: core pre-pilot, local/CI acceptance; hosted staging pending.

## Change summary

- Share conventional/source-traceable setup choices across home, empty publication and evidence setup.
- Add a separate typed evidence contribution page with permitted record lists, document purpose, explanation and contextual farm/batch links.
- Preserve existing private upload, scan, quota and server resource-authorization controls.
- Distinguish failed reads from empty records; clear pending files/explanations when the record changes.
- Add four browser cases covering real conventional inventory, farm/plot/harvest, evidence upload/context and sourcing edited quantity persistence; one failed-read scenario uses a controlled API failure.
- Record founder acknowledgement of the previous shared-action release and merge.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Deep links preselect only records returned by permitted list endpoints. The upload service rechecks entity authorization; client choices grant no access. File/explanation state is cleared on record changes; controls are disabled during submission. Existing audit, quarantine and scan handling remain authoritative. Evidence upload never certifies a claim.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: restore previous web image; existing evidence records remain valid.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author API units (424), types, quality, builds, migration integrity and backlog tests passed. Native Docker/browser execution is unavailable in the author environment. Run `npm run verify:release` on this candidate before merge, then update native boxes and attach its commit-specific report. No hosted staging claim.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: New selectors have accessible labels and responsive layout. Full accessibility review remains open. Plot proof attaches to its parent farm with plot code in the explanation; a distinct plot evidence entity is not introduced.

## Follow-up work

- PRD-003: request-specific evidence checklist and gap guidance.
- QLT-009: reopen and edit an existing saved sourcing brief.
- PRD-011: other permitted empty states and complete accessibility review.
- Hosted operational/security acceptance and performance measurements remain separate gates.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Do not close partial items solely because this implementation is merged. Record native acceptance before assessing remaining criteria.
