## Outcome

Buyers and suppliers can find the next trade action without scrolling through fee history and unrelated controls. A complete eligible document set is submitted automatically by the server, so the trade no longer depends on discovering a separate presentation button. Missing document files, transport reference and bank-security acceptance are visible in one checklist.

## Tracking

- Backlog ID(s): INV-003; PAY-007 and LOG-004 regression coverage
- Issue/ADR: Founder cocoyam investor rehearsal and six screenshots, 2026-10-23
- Target phase/environment: Phase 0 local investor rehearsal; hosted deployment remains on hold

## Change summary

- Replace corridor-specific workspace wording and remove obsolete customer demo shortcuts; retain separate platform admin access.
- Extract material phrases beyond a crop whitelist, retaining review and validation for ambiguous input.
- Explain private source records and recoverable lazy-page loading failures.
- Add task-focused tabs to deal room, contract and fee workspaces, with next action and responsible party above them.
- Collect transport reference alongside the document checklist; preserve drafts across tab changes.
- Add recoverable automatic document submission through the existing locked payment/storage boundary, system audit attribution and operations monitoring.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No source-record access broadening or buyer/seller authority changes. The internal worker takes seller scope from the contract, checks required supplier file ownership and actual storage availability, and uses the existing serialized presentation transaction. A null audit user is allowed only for the explicitly identified system presentation event. Status codes expose no storage keys or provider diagnostics. No automatic money movement, buyer acceptance or bank verification is introduced.

## Database and deployment

- Migration required: yes — 054_automatic_document_presentation.ts
- Backfill/lock implications: brief table locks plus transactional partial index creation; existing eligible unpresented trades will be processed after restart. Operations lock pool grows from six to seven sessions.
- Rollback or compensation: stop the new worker and revert application code while preserving migrated schema and audit/payment history. Migration down refuses destructive reversal after automatic audit events exist; use a forward correction and reviewed payment-issue compensation where needed.
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P1
- Confirmed P0 register ID (if applicable): not applicable; INV-003 backlog priority is not a confirmed P0 defect classification
- Regression test and failure behavior: automaticDocuments.test.ts covers blocked-set recovery and starvation avoidance; documentSubmission.test.ts covers reference, insurance, bank security, stored bytes, handover, plan eligibility, replay and system attribution. paymentWorkflow.integration.test.ts adds concurrent automatic CIF submission, deadline preservation, tenant denial and atomic rollback on audit failure. guidedTradeWorkspaces.spec.ts covers inline reference, retained drafts, keyboard tabs, automatic status observation without a presentation POST, demo roles and failed bank-security chunk recovery. Existing fee, delivery, document and trade-read regressions remain enabled.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author passed 1,667 API unit tests across 175 files, 47 production-build Chromium cases across 12 affected mocked-API suites, and a separate demo-mode login case. API/web builds, workspace/browser types, strict native payment-suite compilation, quality, migration integrity, 90 KiB initial JavaScript budget, authorization, mutation audits, branding, route-state/regression/risk/pilot evidence, locale, frontend boundaries, workspace tools and backlog checks pass. New native database cases cover concurrent submission, deadline preservation, tenant denial and audit-failure rollback; they have not run here. Full Windows release and required GitHub CI are mandatory. Docker/PostgreSQL and hosted staging have not been run in the author workspace.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Tabs have labelled panels, keyboard navigation and wrapping controls; no universal accessibility or physical-device certification claimed. Published claim summaries do not grant private dossier access. Scan cleanliness does not certify authenticity. No new mandatory buyer document approval step is introduced.

## Follow-up work

- INV-003: exact-commit full release, GitHub CI and founder fresh cocoyam rehearsal, including fallback paths and final settlement.
- BRD-005: sender-domain authentication and external branded email rendering remain separate.
- GEO-001: supported-country/named-place policy remains separate from global workspace branding.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
