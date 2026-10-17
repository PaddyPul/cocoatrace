# Title
fix: clarify delivery, fee collection and completed trade presentation

## Outcome
Buyers see why delivery acceptance is disabled, including the required inspection note. Both parties see that goods completion does not mean the platform fee was collected: the recorded payer pays separately after completion and platform finance verifies receipt. The fee statement refreshes when contract status changes.

## Tracking
- Backlog ID(s): delivery acceptance regression, PAY-011/PAY-012 (remain partial)
- Issue/ADR: founder delivery screenshot and unpaid-fee report,2026-10-17
- Target phase/environment: pilot candidate/local release

## Change summary
- Shared rounded register padding protects counts, filters and table content across all12 table-wrap usages; horizontal scrolling retained.
- Dashboard terminal actions show Completed/Cancelled using server action kind and ID, instead of the generic In progress fallback. Fee obligations remain separate.
- Desktop/mobile register geometry and buyer/supplier terminal status regression checks.
- Include the previously unapplied delivery guidance correction and actual journey regression.
- Prominent fee collection state, due timing, payer and external-payment next steps; no automatic deduction/debit claim.
- Refresh fee statement on contract lifecycle changes, retain reference drafts on refresh, and clear unavailable stale statement data after read failure.
- Buyer/payer status regressions and existing real fee journey assertions.
- Reconcile accepted UPL-009/UPL-011 to153/343 (44.6%).

## Security and data review
- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: existing payer-only submission and platform-finance-only receipt verification remain; no new money movement, bank details, tax claim or settlement block. Buyer never receives payer reference history.

## Database and deployment
- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert presentation correction; no ledger rewrite
- Configuration/secrets changed: none

## Verification
- [ ] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author workspace/browser typechecks, quality, web build and backlog checks; actual browser/full release required before merging. Update checkboxes using actual results.

## Product and operations
- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work
PAY-011/PAY-012 and LEG-010: agreed payment channel/instructions, commercial/tax policy and outbound invoicing. Actual provider collection remains separate work. Hosted pilot gates remain open. This correction adds no completion credit.

## Backlog update
- [x] Item remains open and is marked IN PROGRESS (PAY-011/PAY-012)
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
