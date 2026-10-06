# PR title

Enforce cookie origin boundaries and shared PostgreSQL authentication limits

# PR description

## Outcome

A malformed Authorization header can no longer bypass the browser-origin check and then authenticate through a session cookie. Cookie-authenticated writes require the configured origin, and sensitive authentication budgets are shared across API instances rather than reset by IP rotation or process restart.

## Tracking

- Backlog ID(s): SAF-001, SEC-007, IDN-013; related SEC-011 and QLT-002.
- Issue/ADR: docs/runbooks/AUTHENTICATION_BOUNDARY.md; provider/rebranding work remains separate.
- Target phase/environment: core invited-pilot security foundation; local/disposable tests before hosted staging.

## Change summary

- Make explicit Authorization authoritative: invalid/malformed bearer credentials never fall back to cookies.
- Reject absent Origin on cookie writes and foreign/null origins on unsafe requests; ignore untrusted target forwarding headers.
- Keep Express trust proxy explicitly false and use independent route/account-token-user and immediate-peer IP budgets.
- Add migration 031 and atomic bounded PostgreSQL counters with keyed identifiers, bounded expired-row cleanup, Retry-After and fail-closed outages.
- Derive limit targets from each route's actual identity field, preventing ignored JSON fields from rotating the budget.
- Add unit, real-session/PostgreSQL concurrency and browser regressions; update cookie-based direct browser API fixtures to declare their disposable app origin.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No raw IP/email/token/secret URL is stored in counters. Explicit bearer clients can omit Origin, with no cookie fallback; supplied foreign/null Origin is always denied. Behind a proxy, the immediate-peer IP budget can be shared by users; trusted ingress/client-IP configuration is deliberately deferred. Existing auth/security event behavior remains; counters are ephemeral operational records, not immutable audit. Shared-store outages block sensitive actions with a sanitized 503. Native concurrency/session verification is required before merge.

## Database and deployment

- Migration required: yes — 031_shared_auth_rate_limits.ts, registered in the integrity manifest
- Backfill/lock implications: additive small counter table/index; no customer-row backfill; atomic bucket updates serialize only their key
- Rollback or compensation: preserve additive table; forward repair preferred. Old API rollback restores weaker protections and requires reviewed/restricted exposure. Do not drop the table or reset production counters as a workaround.
- Configuration/secrets changed: no new secrets/settings; existing WEB_URL origin and shared JWT secret provide origin identity and domain-separated keyed identifiers. Apply migrations before starting the new API.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 319 API tests/45 files pass, including 28 focused boundary tests; quality checks and ten policy/contract tests pass; workspace/browser type checks, builds, migration integrity and backlog tests pass. Actual focused Chromium policy probe passes normal/foreign/missing-origin and malformed-header cases. Twelve PostgreSQL cases and one real-account browser case are included but native full execution is unavailable here. Before merge, run npm run verify:release, inspect the complete report and check integration/E2E only after success. Existing bundle-size warning remains tracked. Add actual native result/SHA/CI links here.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Stable ORIGIN_NOT_PERMITTED, AUTH_RATE_LIMITED and AUTH_RATE_LIMIT_UNAVAILABLE responses; retry headers supplied. This changes no visual UI layout. Centralized alerts/retention remain open OPS work, not newly claimed monitoring. No escrow/certification/provider or universal security claims.

## Follow-up work

IDN-011/012 and SAF-004: suspension, privileged MFA/recovery. SEC-011: public scan/QR/upload intent and edge abuse budgets. SEC-007: any explicitly trusted ingress policy, supported cookie-client compatibility and deployment verification. OPS-006/010: rate/protection outage alerts, retention/scheduling and operational ownership. LNG-002: localized stable API error presentation. PER-004: representative authentication/load budget. Provider marketplace and runtime rename remain separate BRD/GEO/SVC work.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: SAF-001/SEC-007/IDN-013 remain in progress pending native release evidence; broader endpoint/hosting/admin scope remains open. Do not close items based only on local unit success.
