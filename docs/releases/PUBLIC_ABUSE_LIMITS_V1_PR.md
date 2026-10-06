# PR title

Bound public profile, QR, scan, invitation and evidence-upload abuse across API workers

# PR description

## Outcome

Public scans and QR/profile requests can no longer create unbounded handler work within an application's shared budget. Evidence uploads are throttled before raw-body parsing/storage/scanning, and upload intents/team invitations have authenticated member and organization budgets. A worker restart or a changed slug, token, request identity field or forwarded IP cannot provide a fresh allowance.

## Tracking

- Backlog ID(s): SEC-011; related SEC-010/017, OPS-003/010 and PER-001/004.
- Issue/ADR: docs/runbooks/PUBLIC_ABUSE_LIMITS.md; docs/pilot-gates.json CORE-abuse.
- Target phase/environment: invited-pilot security foundation; disposable automated release, then reviewed hosted ingress.

## Change summary

- Add a dedicated typed public/resource budget policy and small HTTP limiter adapter, reusing atomic PostgreSQL counters and database-clock expiry.
- Use hard-coded operation namespaces, deployment/actual-peer ceilings and authenticated user/organization quotas. Never derive buckets from raw slugs, filenames, token/signature paths or body-supplied organization IDs.
- Stop creating new peer/actor buckets once earlier shared ceilings are exhausted; retain bounded indexed pruning and saturating counters.
- Wire limits before public handlers and signed-content raw parsing; require authentication/permission before charging private actor quotas.
- Return actionable 429 retry headers; return 503 on counter-store failure without handler effects or in-memory fallback.
- Add 13 unit tests and 10 real PostgreSQL cases for threshold/rotation/isolation/concurrency/route wiring/pre-parser/expiry behavior.
- Reconcile founder-confirmed Incoterm merge: LOG-001 closed; exact named-place/mode/domestic work and privileged recovery remain open.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Live actor IDs determine private quotas. Persisted keys are HMAC hashes. Opaque upload capabilities still require signature/expiry/entity checks; quotas do not grant access. Rejected requests change abuse counters/request logs only, not evidence/scans/invitations or commercial data. Independent workers share atomic counters. Existing browser-origin/credential rules and authentication limits remain. No new audit email/outbox side effects.

## Database and deployment

- Migration required: no; reuse 031 shared counter table without editing its migration.
- Backfill/lock implications: no customer backfill. Atomic short counter-row locks; global operations intentionally share a ceiling and can shed legitimate traffic under attack. Measure hot-row contention before scaling.
- Rollback or compensation: reverting middleware removes this protection; restrict public exposure before rollback. Counter rows expire normally; do not delete production counters to evade a limit.
- Configuration/secrets changed: none. Workers require the same existing database/key material. Fixed code-reviewed 15-minute budgets are documented; no test-only production bypass.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 355 API unit tests/49 files, quality/policy/script checks, workspace/browser type checks, API/web builds, migration integrity and backlog tests pass. Ten real PostgreSQL regressions added; normal identity/file/trade browser journeys remain in the complete release. Native Docker/PostgreSQL are unavailable in author environment. Run npm run verify:release; add the actual successful candidate SHA/report/CI link and tick integration/E2E only after success. Existing frontend chunk-size warning stays PER-005.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No new UI; API errors and Retry-After are actionable. Existing request-log status/redaction retained; centralized alerts are not claimed. Peer attribution remains the real socket peer, not arbitrary forwarding headers. Current proxies can aggregate visitors into one peer budget; hosted ingress configuration must be reviewed. This is application abuse mitigation, not comprehensive DDoS defense or proof of measured safe capacity.

## Follow-up work

SEC-007/011: trusted-ingress topology/client attribution and operational tuning. SEC-010, PER-001/004: concurrent memory/scanner bounds, graph/query budgets and measured load capacity. SEC-017 and OPS-003/010: centralized alerts and monitored cleanup/worker operation. IDN-012/SAF-004: privileged phishing-resistant MFA and recovery. No scan-count uniqueness, file-safety, escrow, hosting or valuation claim introduced.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: SEC-011/CORE-abuse stay partial pending native release/merge evidence. LOG-001 is closed on founder-reported all-term responsibility release/merge; CORE-transport remains partial for wider route/mode/named-place criteria. Recount: 72/342 complete (21.1%), 53 partial, 217 open; core pilot 8/28 closed (28.6%), no partial credit or valuation inference.
