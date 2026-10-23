## Outcome

Local investor rehearsal uses a passkey-capable hostname, and shared demo setup no longer implies a new empty account. An explicitly confirmed reset can return only the dedicated marked synthetic workspace to first-use state. Existing records remain intact on ordinary login/restart; privileged assurance is never bypassed.

## Tracking

- Backlog ID(s): INV-003, INV-002, PRD-001, IDN-012, SAF-004
- Issue/ADR: docs/runbooks/LOCAL_INVESTOR_REHEARSAL.md; founder reports stale demo trades and invalid127.0.0.1 passkey domain.
- Target phase/environment: Phase0; local synthetic preview/rehearsal only. Hosted deployment remains paused.

## Change summary

- Use http://localhost:14000 for the browser origin, configured API origins, new local email links and smoke checks. Continue binding the Docker port to127.0.0.1. Accept legacy saved IP state only to migrate it on start without clearing data.
- Explain unsupported IP origins in the passkey page with an explicit localhost link, preserve sign-out/read behavior and prevent attempted passkey writes on IP origins. Return an actionable server error for unsupported passkey domains; preserve actual WebAuthn origin/RP validation and fresh MFA requirements.
- Label shared-account setup as rehearsal with retained history rather than new accounts. No login action deletes records.
- Add demo:rehearsal:reset with the exact DELETE_SYNTHETIC_PREVIEW acknowledgement. Verify the dedicated initialized database read-only before removing only the fixed preview project's volumes; rebuild fresh synthetic identities, empty operational records and the capture outbox. Reset intentionally removes preview passkeys too.
- Add CI checks for confirmed reset, empty buyer/supplier trade actions and actual localhost virtual-authenticator admin enrollment/re-login/fresh assurance. Add refusal/origin and browser guidance regressions.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No remote reset endpoint or new application permission. Fixed Compose project/files, explicit confirmation, dedicated database/user/host/mode/marker and query/fragment/port guards; failed preflight never removes volumes. The read-only marker check makes no database changes. Confirmed reset stops/removes only preview services and deletes their synthetic database, evidence, capture and scanner volumes. Retain owner-generated connection secrets for reinitialization. Existing application/test projects remain separate. Passkeys are not relaxed to accept IP addresses or rewritten under another RP. Fresh administrator assurance remains required for fee writes. CI enrollment uses a disposable virtual device, not a claimed physical-device acceptance.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none to application data. Explicit preview reset removes its own synthetic volumes and reseeds; it does not migrate customer records.
- Rollback or compensation: normal start is nondestructive. Reset deletion is irreversible without an independent backup; do not confirm it if records must be kept. Reverting code does not restore deleted preview data. Old IP-origin cookies/email links require signing in and generating new messages on localhost.
- Configuration/secrets changed: local preview WEB_URL/PUBLIC_WEB_URL move to localhost. No application signing keys are rotated. No cloud resources or external delivery are enabled.

## Defect regression

- Defect severity: P1 — local investor-rehearsal blockers; no confirmed P0
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: unsupported IP/non-HTTPS passkey-origin cases; localhost/legacy state migration cases; reset without exact confirmation stops before Docker/state reads; failed preflight never invokes down/volumes/up. Browser regression requires the IP-origin guidance, no passkey writes and enabled enrollment at localhost. CI disposable preview regression checks real WebAuthn RP localhost, enrollment, restricted re-login and fresh assurance plus empty buyer/supplier trade actions after reset.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author1646 API tests across172 files,14 preview/rehearsal runner tests, quality/backlog checks, API/web builds, browser types and initial-JS budget pass. Three affected Chromium scenarios pass against production web with mocked APIs, including IP/localhost passkey guidance and retained-key read-error behavior. Actual Docker reset/seed and preview virtual-authenticator CI execution remain required; physical Windows Hello/security-key enrollment and actual fee receipt verification remain founder manual acceptance. No cloud or universal investor journey acceptance inferred.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

INV-002/003: perform and record the full local trade plus separate recall rehearsal and fallback. SAF-004/IDN-018: physical factor/recovery and hosted operator acceptance. BRD-005/IDN-021: real sender/domain and external inbox acceptance. ENV/BST: deployment remains on hold. This correction does not close those entire rows.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

