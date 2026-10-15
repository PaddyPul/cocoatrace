# PR title

feat: split frontend routes and public handlers with safer release tooling

# PR body

## Outcome

Route pages load on demand instead of entering the initial JavaScript payload. Public rendering, administration and recall handlers have separate owners while preserving existing routes and authorization. Explicit demo reset refuses remote or driver-overridden targets even when an old override flag is supplied. Private build diagnostics are implemented with honest unknown-stamp handling. Four already accepted architecture decisions are reconciled; three new outcomes target closure.

## Tracking

- Backlog ID(s): UX-009, ARC-009, ENV-016; partial ENV-014.
- Reconciled acceptance: prior LOG-003/DAT-005/DAT-006/GOV-004/GOV-008 plus DEC-002/003/004/006.
- Issue/ADR: adr/README.md; performance/FRONTEND_ROUTE_BUDGET.md; security/ACCEPTANCE_RECONCILIATION_2026-10-15.md.
- Target phase/environment: engineering/CI acceptance; stamped hosted deployment remains unverified.

## Change summary

- Lazy-load route pages under loading/error recovery and existing auth/provider boundaries; avoid eager record barrel imports.
- Enforce90KiB gzip initial JavaScript budget including transitive static imports after production build in release/CI. Author measurement72,214 gzip bytes,221,029 raw bytes, one initial chunk.
- Move public handlers into rendering/administration/recalls modules and shared URL helper; retain compatibility exports and handler behavior.
- Harden existing explicit synthetic reset before pool creation: staging/production always refused; simple recognized loopback PostgreSQL targets only, no URL query/fragment overrides or remote-override bypass.
- Add protected /operations/deployment projecting validated artifact SHA/build time/runtime environment only; Docker/host builds stamp the artifact. Missing SHA remains explicitly incomplete.
- Add build metadata, reset, public boundary and bundle-budget regressions; maintain the checked197-route register.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: auth guards precede lazy route rendering; bundle splitting is not a security boundary. Public handler policies/side effects are unchanged. Diagnostics requires existing wildcard/session/privileged assurance and no-store; no DB/storage configuration, secrets or unvalidated artifact fields are exposed. Reset query options such as host/service cannot address a different target behind a local-looking URL. No reset was executed. This does not make real data synthetic or prove that an operator has correctly isolated resources.

## Database and deployment

- Migration required: no; frozen assets unchanged.
- Backfill/lock implications: none; no reset or data mutation occurs through verification.
- Rollback or compensation: revert lazy routes/controllers/tooling together; retain current business/audit state. Do not restore the hazardous remote-reset exemption without reviewed safety rationale.
- Configuration/secrets changed: BUILD_GIT_SHA optional full40 build argument; absent local builds are incomplete. No credentials, provider signup, paid service or dependency changes. Existing legacy reset config parses but no longer grants a bypass.
- Deployment note: compile and deploy build-metadata.json with the API; timestamp is builder time, not process startup. Existing Compose does not supply SHA by default. ENV-014 stays partial until a correctly stamped artifact is deployed and read back privately.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed1,114 API unit cases, six HTTP cases, three budget cases, two actual build-stamp cases, release/container contract checks, code quality, workspace/browser types, API/web builds, register/backlog/risk checks. Five affected native suites compile strictly. Browser routing/lazy-load and private diagnostics native runtime require exact-commit full release and required CI. Record passing SHA/date and CI result before merge. No additional manual persona loop is required.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: initial JS transfer budget is measured, not a mobile latency/LCP/accessibility claim. PER-005 remains partial. Current limitations2026-10-14.1 was reviewed and remains accurate. Unknown build identity is not reported as a verified deployment. Demo reset is an explicit maintenance operation and never added to startup/release acceptance.

## Follow-up work

- ENV-014/008/009/013: supply reviewed build SHA, immutable promotion and protected actual deployed readback/smoke evidence.
- PER-005/UX-008: actual mobile performance/accessibility and keyboard evidence.
- DEC-001/005/007/008/009: actual hosting/email/business/commercial decisions remain open; accepted technical architecture does not supply them.
- Hosted ENV/OPS/SAF and independent security gates remain open. No RLS deployment or managed resource provisioning is inferred.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Previously accepted integrity and four technical decision reconciliations make110/343 (32.1%). Close UX-009, ARC-009 and ENV-016 after integrated release/review/merge to113/343 (32.9%). ENV-014 advances but stays partial. Core11/28 (39.3%) and provider-inclusive11/40 (27.5%) are unchanged; full roadmap closure is not hosted pilot readiness.
