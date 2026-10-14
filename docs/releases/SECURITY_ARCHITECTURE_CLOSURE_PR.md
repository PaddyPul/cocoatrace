# PR title

feat: complete URL security review and modular frontend boundaries

# PR body

## Outcome

Supplier-provided tracking and hero URLs follow an explicit HTTPS authority policy; unsafe historical links cannot become active tracking controls. Frontend API requests and domain contracts now have feature owners while preserving current callers and one shared session/MFA transport. A source-backed threat model records six critical abuse scenarios and remediation gaps. Together these supply the engineering outcomes for four named backlog items in one release candidate.

## Tracking

- Backlog ID(s): SEC-009, SEC-015, ARC-016, ARC-017; partial SEC-019.
- Issue/ADR: security/OUTBOUND_URL_REVIEW_2026-10-14.md, security/THREAT_MODEL.md, architecture/FRONTEND_HTTP_CLIENTS.md and architecture/FRONTEND_DOMAIN_TYPES.md; no new ADR.
- Target phase/environment: controlled pilot preparation; local/CI acceptance, not hosted operational certification.

## Change summary

- Validate tracking/hero HTTPS URLs without credentials, custom ports, IP literals or local-only hosts; bound length and reject ambiguous control/whitespace input.
- Recheck legacy tracking values at rendering, label destination hosts, isolate new tabs/referrers, suppress unsafe public hero values and use same-origin product links.
- Extract one shared HTTP/session implementation and ten feature clients; preserve the existing 56-export compatibility surface and signed-MFA integration.
- Move all 35 existing domain declarations unchanged into fourteen type-only owners; migrate 27 consumers and retain compatibility exports.
- Require six shared-transport regressions in release/CI; add seventeen API URL cases, API/browser policy parity and two shipment-rendering browser scenarios.
- Publish the six-scenario threat model and a vulnerability reporting/triage policy with private-channel prerequisites explicitly unverified.
- Record the founder-accepted trade-boundary release separately from this candidate.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: provider destinations are syntactically allowed, not verified or endorsed. No destination is fetched or proxied by the API. Existing authorization, cookie credentials, single token state, session expiry and bounded MFA retry remain. No new business mutation/audit/outbox semantics or recipients are introduced. Threat-model gaps are explicit and do not become accepted deployment risks by publication. SEC-019 remains partial until a real private intake/owner/backup and synthetic acknowledgement test are verified.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: none. Historical URL data is preserved; unsafe tracking is inactive and unsafe public hero output is null.
- Rollback or compensation: revert UI/API/helper/clients together; no data rewrite. Reverting the URL controls restores the former less restrictive behavior and needs security review.
- Configuration/secrets changed: none; no dependencies or paid services added. One new package test alias and release/CI gate use existing tooling.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 1,062 API cases, six HTTP boundary regressions, the browserless URL parity scenario, code quality, workspace/browser types, API/web builds, authorization register, release-runner and backlog checks. Existing build chunk warning remains. Two new actual-browser rendering scenarios, existing native suites and full signed-MFA/persona journeys require the exact-commit release and required CI. Record passing SHA/date and CI evidence before merge; then mark applicable verification boxes. No repeat manual persona checklist is required.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: unsafe legacy tracking shows an actionable unavailable state; safe links retain an explicit destination host. No trusted-provider claim is introduced. Public hero images are not currently rendered. No new legal safe harbor, bounty, monitored mailbox, hosted capacity or valuation assurance is promised.

## Follow-up work

- SEC-019: enable/verify private reporting, accepted primary/backup ownership and a synthetic private intake/acknowledgement test.
- SEC-006/008/012/013/014/018/020 and SAF gates: remaining resource/field conventions, deployed CSP/secrets/private infrastructure, repository settings, independent review and release security acceptance.
- ARC-021/022: OpenAPI and generated/strong API response contracts; type-only domain modules are not runtime validation.
- Existing threat-model gap IDs and hosted OPS/PER/ENV gates remain open; no new shadow backlog is created.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Closure targets after integrated acceptance: SEC-009, SEC-015, ARC-016, ARC-017. SEC-019 advances but stays partial. Accepted total is 88/343 (25.7%); accepting all four yields 92/343 (26.8%). Core pilot stays 11/28 (39.3%), provider-inclusive 11/40 (27.5%). Closure targets do not imply hosted pilot approval.
