# PR title

Require current usable proof before resolving a recall

# Replacement PR description

## Outcome

A recall manager cannot close a safety notice using rejected, infected, missing or cleanup-ineligible evidence. Proof checks run outside database write locks; resolution revalidates current evidence and manager authority before updating the notice.

## Tracking

- Backlog ID(s): PER-003, OPS-010; recall proof boundary checkpoint in DELIVERY_BACKLOG.md
- Issue/ADR: docs/runbooks/EVIDENCE_RESOURCE_GAPS.md
- Target phase/environment: pilot security prerequisite; local/CI regression suite

## Change summary

- Scope bounded proof preflight to an authorized manager and the exact recall.
- Recheck validation, scan, review, private key/provider and cleanup eligibility under evidence row locks; reject changed proof fingerprints.
- Keep recipient acknowledgement, recovery accounting and retained inventory holds authoritative.
- Add real PostgreSQL/API denial, provider-race and lock-contention regressions; record the previous wave as accepted.
- Build batch-scoped deduplicated public notice associations and check retained/disposed stock independently of page filters, preserving safety warnings.
- Add safe upload fixture stage/code diagnostics and an optional validated single-suite diagnostic runner; the default release still executes all integration cases.
- Filter holdings candidates before recall assessment, assess each distinct batch once, and report safe HTTP errors before checking native page items.
- Assess legacy marketplace recall visibility per distinct batch and reject over-limit IDs before full-row/trust enrichment, preserving production deadlines.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: provider I/O is outside locked safety mutations. Scoped metadata is revalidated inside the transaction. Boolean existence checks cannot prevent out-of-band provider mutation after preflight. Notice resolution does not certify external claims or automatically release inventory holds.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; provider checks precede safety mutation locks.
- Rollback or compensation: revert code; no data rewrite.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: append exact tested commit and release report after all checks pass. Author: 780 API assertions, quality, workspace/browser types, API/web builds, migration integrity and backlog tests pass. Eleven new native recall cases compile strictly. Native Docker/browser execution remains pending founder and CI.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- No UI layout changes.

## Follow-up work

PER-003: streaming, cross-instance admission, provider versions, hosted capacity and failure/crash canaries. OPS-010: cleanup scheduling, alerts and dead-letter recovery. Public evidence availability consistency remains a follow-up.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Broad performance/operations criteria remain open; record this security slice after release and merge/pull acknowledgement.
