# PR title

Reconcile backlog evidence and define BetterTrade core and provider pilot gates

# PR description

## Outcome

Replace stale CocoaTrace-only pilot assumptions with an auditable BetterTrade launch plan. Reconcile five overlooked completions, recognize 23 partial implementations and specify 32 new branding, geography, logistics-provider, security and performance outcomes. Separate the buyer–supplier core pilot from provider-enabled fulfillment and preserve existing external transport arrangements.

## Tracking

- Backlog ID(s): GOV-001; status reconciliation ENV-007, ARC-025, TRD-013, LOG-009, QLT-003; planning BRD-001–004, GEO-001–005, SVC-001–012, PER-001–006, SAF-001–005.
- Issue/ADR: docs/adr/002-bettertrade-platform-boundaries.md (proposed implementation design).
- Target phase/environment: pre-pilot planning, synthetic demo and future isolated core/provider pilot gates.

## Change summary

- Update North Star, pilot operating model, architecture baseline, production readiness, execution queue and risk register; archive superseded planning detail.
- Add core/provider launch register and evidence audit with explicit partial/blocked states, founder-report limitations and valuation boundaries.
- Define separate goods agreement, fulfillment terms and provider service order, with job-scoped disclosure/permissions and separate service financial records.
- Add read-only backlog progress calculator, regression tests and CI check, with Windows LF policy.
- Plan a staged BetterTrade rename preserving migrations, storage/volumes and authentication identifiers; no runtime rename or provider implementation in this PR.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: These checks document design review, not implemented provider security. Existing origin/throttling/admin/hosting gaps remain open. Progress script reads versioned repository documents and validates IDs/evidence references; it does not access customer records.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert the planning/tooling commit; no customer-data mutation
- Configuration/secrets changed: none; CI gains a backlog-register test and formatting scope gains explicit LF paths

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: author npm run check:quality passes (lint/format/script contracts plus 10 policy/contract tests); npm run test:backlog passes two progress/register regressions; npm run backlog:progress validates references and reports 69/342 roadmap closures, 7/28 core gates and 0/12 additional provider gates. No application code, dependency or schema changes; domain suites were not repeated for grooming. Existing language correction requires separate native release acknowledgement. Update this section with actual PR CI/owner evidence before merging; never tick unrun checks.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: First two checks concern the documented scope/limits and read-only progress output, not closure of application UX/monitoring gaps. UI accessibility not applicable to this docs/tooling change. Existing user journeys are unchanged.

## Follow-up work

Security queue: SAF-001, IDN-011–013, SEC-007/010/011, SAF-004. Product coherence: PRD-003–006 and QLT-009/010. Hosted operations/recovery/performance: ENV-004–014, OPS-001–012, PER-001–004, IDN-021. Branding and provider work remain open under BRD/GEO/SVC. Pilot enrollment, legal/fee approval, investor traction and independent assurance are not claimed complete. Full translated journeys remain LNG-001–005.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [x] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: Five evidence-backed corrections are checked complete; 23 partial items are marked in progress; newly scoped work remains open. The checks refer to different documented items, not a claim that provider/rename/pilot launch is complete. Roadmap percentage is equal-item closure, not effort-weighted progress or valuation readiness.
