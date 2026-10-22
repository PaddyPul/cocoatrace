## Outcome

Users can obtain expiring private document links without granting anonymous access, review certificate/document renewal tasks, and act on recall acknowledgement deadlines. A completed provider read cannot release bytes after current session/role/resource authorization or the link window has changed. Reading a reminder never acknowledges a recall, extends validity or releases stock.

## Tracking

- Backlog ID(s): UPL-010, UPL-012, RCL-004; reconcile accepted UPL-014
- Issue/ADR: docs/runbooks/TIMED_EVIDENCE_RECALL.md; existing storage/session/jobs ADRs apply
- Target phase/environment: Phases 1–2; three local engineering closure targets, native/full release and required CI before acceptance. Hosted/provider gates remain separate.

## Change summary

- Issue up-to-60-second user/organization/session/evidence-bound HMAC download links; recheck expiry, current credentials, MFA, permission and existing evidence policy after provider I/O, before attachment release.
- Use fresh links for interactive downloads and retain the live-authorized legacy canonical API action for compatibility; surface actionable invalid/expired-link errors.
- Store optional uploader-recorded document expiry through intent/completion and critical audit without replacing the content checksum; show UTC dates and own-organization renewal notices.
- Add inclusive-UTC certificate validity reminders, a bounded30-day/expired feed, current permission checks, obsolete-task suppression and changed-deadline unread identities.
- Snapshot manager-selected1–168h acknowledgement targets (default24h) with recall activation/audit; show pending/overdue participant and manager contact tasks and response-page guidance.
- Add11 native regressions, focused policy/HTTP/credential cases, expiry/deadline browser assertions and actionable notification links. Reconcile main PR #141 and UPL-014 acceptance.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Links bind current session/user/organization and use a separate signing domain with the existing evidence signing key. They grant no anonymous sharing or lasting authority. Query values are omitted from request logs; signed links are not persisted. Redemption and final authorization preserve current scan/review/protected-document rules. Reuse by the same authorized session within the window is allowed. Feed queries use organization/permission predicates and sentinel overflow rather than truncation. Unknown dates are not invented. Read receipts never renew documents, acknowledge recalls or release inventory. No new external email/outbox is introduced.

## Database and deployment

- Migration required: yes — forward053, registered digest; applied/frozen migrations unchanged
- Backfill/lock implications: nullable document-expiry and recall-deadline columns; no fabricated historical backfill. Tenant/expiry/pending-participant indexes use normal migration/index locks; stage for actual table volumes before hosted deployment. Deploy schema before API.
- Rollback or compensation: old API clients retain the canonical authenticated action. Code rollback preserves recorded dates; down migration refuses populated timed history and forward repair is preferred. Keep existing database/storage volumes and migration history. Reminders are current derived reads, not destructive scheduled decisions.
- Configuration/secrets changed: none; domain-separated HMAC uses the existing upload signing secret. Key rotation invalidates outstanding short-lived links. No additional provider or paid service.

## Defect regression

- Defect severity: none — backlog enhancements; no confirmed P0 classification
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: `invalidates links after session revocation without granting a replacement session their authority`; `rechecks expiry after a slow provider read and withholds attachment bytes`; `withholds bytes when the source becomes infected while the provider read is pending`; `snapshots recall deadlines, automatically exposes overdue participant/manager tasks and clears them only on acknowledgement`. Native definitions are included; runtime acceptance is still pending. A controller regression verifies final authorization is actually wired before byte release.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author full API unit suite (1,630 tests across 170 files), workspace/browser types, API/web builds, quality, migration integrity, authorization/route inventory, backlog and frontend transport tests pass.13 affected Chromium scenarios passed against the production web build with mocked APIs, including new expiry serialization, deadline confirmation/draft retention and three private reminder links.11 native scenarios compile strictly; Docker/PostgreSQL and complete real-persona browser runtime require the founder's exact-commit full release. Record that candidate SHA, passing summary and required CI before checking runtime boxes. No hosted acceptance is inferred.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- New date/hour controls have accessible labels and preserve drafts; focused browser tests pass. Full mobile/manual acceptance is not inferred. Reminders recompute at feed reads/refresh; external push/email, historical inbox retention and statutory deadlines are not claimed.

## Follow-up work

PRD-008/IDN-021 external email/provider inbox acceptance; UPL-013 retention/legal hold/backups; UPL-018 private restore; SEC-017 immutable security retention; ARC-013/QLT-002 remaining action/resource matrix; OPS-006 hosted alert ownership; ENV-004–014 hosted deployment/clock/key acceptance; CT-01–18 optional Canton work. Historical document/recall dates remain unknown until genuine records supply them.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

UPL-014 is reconciled as accepted after founder-reported release/merge of main PR #141. Accepted count171/362 (47.2%); all three new targets remain IN PROGRESS pending release/review acceptance. Accepting all three yields174/362 (48.1%). Core gates11/28 and provider-inclusive11/40 remain unchanged.
