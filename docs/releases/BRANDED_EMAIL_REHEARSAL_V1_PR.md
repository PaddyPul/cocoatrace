## Outcome

Recipients receive recognizable BetterTrade transactional messages with clear actions and truthful destination/support information. The founder can rehearse identity emails and the investor story locally through a capture-only outbox without a domain, external SMTP provider or cloud resource. Deployment remains on hold.

## Tracking

- Backlog ID(s): BRD-005, INV-002; coordinates INV-003, IDN-021, PRD-008, BRD-004
- Issue/ADR: docs/branding/TRANSACTIONAL_EMAIL_TRUST.md; docs/runbooks/LOCAL_INVESTOR_REHEARSAL.md
- Target phase/environment: Phase0; local synthetic investor rehearsal. External sender/domain/inbox acceptance remains open.

## Change summary

- Render all seven existing SMTP categories through one escaped, responsive BetterTrade HTML/text presentation; show action labels and the actual configured hostname instead of displaying credential paths as button labels.
- Add BetterTrade From display name, optional validated EMAIL_SUPPORT_ADDRESS/support Reply-To, explicit nonproduction labels and truthful no-support-address fallback. Wrap HTML MIME as76-column base64 for SMTP compatibility.
- Validate the brand payload before opening an SMTP connection. Retain source text, backend token semantics, same-origin credential checks, outbox leases and sent/suppressed behavior; caller HTML is not trusted by the shared wrapper.
- Add demo:rehearsal:start with internal Mailpit SMTP and loopback-only capture viewer, independent persisted invitation key and the existing real scanner/private data stack. Ordinary preview/share remain email-disabled. No external relay is configured.
- Require branded captured identity HTML in actual browser journeys and exercise local rehearsal startup in CI. Supply buyer/supplier/admin, email and separate recall rehearsal instructions without claiming founder execution.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Escape text/subject/URLs in HTML; only standalone configured-origin HTTP(S) URLs without userinfo/fragments become actions, with HTTPS required in deployed environments. Preserve credential-bearing text fallback without logging it. The capture viewer contains local live action credentials and must never be exposed or uploaded. No new recipient or tenant grants. Local test sender does not claim domain ownership or authentication. No external messages are sent by the rehearsal stack.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none. Preview records/volumes are retained.
- Rollback or compensation: revert presentation/runner changes; use ordinary demo:preview:start for email-disabled mode. Stop with demo:preview:stop; do not delete preview secrets while retaining volumes.
- Configuration/secrets changed: optional EMAIL_SUPPORT_ADDRESS; local rehearsal key generated and stored only in ignored preview state. Mailpit capture uses synthetic internal SMTP credentials; no real provider keys or cloud resources.

## Defect regression

- Defect severity: none — requested presentation/rehearsal enhancement
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: emailBranding tests cover escaped hostile text, matching-origin buttons, rejected unsafe origins/addresses, test labels, all seven categories, MIME alternative bodies and header injection; real socket SMTP regression decodes wrapped HTML. Inbox isolation tests require brand without leaking bodies on failure; invalid stored rehearsal key stops before Docker calls. Existing token-revocation/expiry and sender-failure contracts remain in release.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: full author API suite1636 tests across171 files passes; focused presentation/wire12 tests pass; preview/rehearsal runner11 and inbox-isolation4 tests pass; API build, browser typecheck, quality and backlog checks pass. Chromium render checks at390px and1000px show the action button and no horizontal overflow; mobile rendering visually reviewed. Actual Docker/PostgreSQL/browser capture and rehearsal startup require the founder full release/CI. No manual investor journey, external Gmail/Outlook inbox or cloud acceptance is claimed. Web source is unchanged; production build remains in the standard full release.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

BRD-005/BRD-004/IDN-021: owned sender/domain, provider approval, SPF/DKIM/DMARC/alignment, actual Gmail/Outlook inbox rendering/delivery. INV-002/003: founder executes and times full local story, records blockers and fallback; clean-reset repeatability remains open. PRD-008: unimplemented lifecycle email events remain open. LNG-003: complete reviewed localization is separate. Deployment remains paused; no cloud capacity or trial credits consumed.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

