# PR title

feat: add isolated saved searches and private contextual support requests

# PR body

## Outcome

Buyers and suppliers can save named searches/filters in Marketplace, Inventory and Offers and reapply them without losing pagination context. Authenticated users can report a workflow issue, receive a durable reference and check its status; platform operators can review the private queue with fresh passkey assurance and audited status decisions.

## Tracking

- Backlog ID(s): PRD-013, PRD-015 closure targets; accepted TRD-018/020 reconciled.
- Issue/ADR: docs/runbooks/WORKSPACE_SUPPORT_FILTERS.md.
- Target phase/environment: application workflow/local and CI acceptance; hosted monitoring and external response coverage remain separate.

## Change summary

- Add bounded, validated device-local presets keyed by account/organization/register; save/apply/delete, page reset and explicit session-only fallback preserving unreadable stored bytes.
- Clear parent filters on identity change, preserve initial URL intent and include organization in catalogue request isolation.
- Add shell contextual entry carrying only workflow enum/optional UUID, private reporter history, durable reference and exact-body idempotency across uncertain retries.
- Add wildcard operator review with fresh passkey/live authorization, expected-status conflict check and atomic auditing; preserve review notes through errors and explicit record reload.
- Add mandatory workspace-tool policy tests to release/CI, support unit/native/browser tests and saved-filter browser definitions.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: private requester+organization scope on every read, bounded cursor/hash scope, no-store responses and live transactional actor checks. Saved-filter values are whitelisted, reject URLs/usernames/control characters and do not grant permissions. Support context omits arbitrary URLs/query strings/files. Reports are plain escaped text; body is absent from audit metadata and no automatic external send occurs. Same key/different body409; first write and audit commit together. Status review checks observed status; same-status note replacement remains auditable.

## Database and deployment

- Migration required: yes,043_support_requests; registered frozen history unchanged.
- Backfill/lock implications: new table/index/idempotency constraint and immutable report-body trigger; no historical data rewrite. Support mutations serialize access decisions with live identity checks.
- Rollback or compensation: reviewed forward correction preserving records and audit; older images may reject newer ledger. No volume/database reset.
- Configuration/secrets changed: no dependencies, provider, secrets or paid service. Added npm test:workspace-tools. Device preferences are local, not synchronized.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author1,186 API unit cases, five workspace-tool policy cases,14 release-runner cases, nine frontend HTTP/environment and six locale cases passed, along with quality, workspace/browser types, API/web builds and strict native test compilation. Migration/authorization/branding/backlog/risk checks passed; initial JS73,261 gzip bytes stays within90KiB budget. Native definitions cover idempotent concurrency, requester/cursor isolation, totals, immutable report, fresh assurance, stale-status conflict and real audit-trigger rollback. Browser definitions cover presets across account/workspace identities, blocked/corrupt storage, safe retry, history failure and review-note retention. Docker/Chromium runtime acceptance is not claimed here; exact-commit full release and required CI remain mandatory. Add final SHA/date and CI evidence after pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: clear device-local preference policy and unknown/safe retry states. Support requests are for private operator review; no invented monitoring owner, external contact, email delivery or response-time promise. UUID entity context is reporter-provided, not access/ownership verification.

## Follow-up work

- PRD-007/008: notification center and additional lifecycle emails.
- OPS-013/SEC-019: retention/deletion operations and actual monitored private contact.
- ENV/OPS/PER/UX: hosted operational acceptance, independent CI archive and human/mobile accessibility review.
- Logistics service-marketplace roadmap remains open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted127/343 (37.0%); target129/343 (37.6%) after full release/review/merge. Core11/28 and provider-inclusive11/40 unchanged. Completion counts do not establish valuation or pilot safety.
