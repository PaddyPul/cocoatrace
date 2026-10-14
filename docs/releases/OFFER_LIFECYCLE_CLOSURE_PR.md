# PR title

feat: complete pending-offer decisions and pilot release guidance

# PR body

## Outcome

Buyers can withdraw a pending offer before seller acceptance. Sellers must explain rejection, and both parties can read the original reason without rewriting the decision. Customer guidance explicitly keeps negotiation external and explains pilot limitations. Release/versioning and deprecation conventions are published alongside one changelog. This candidate targets six whole backlog outcomes.

## Tracking

- Backlog ID(s): TRD-010, TRD-011, TRD-012, GOV-007, GOV-009, GOV-010.
- Issue/ADR: pilot/KNOWN_LIMITATIONS.md and governance/RELEASE_AND_COMPATIBILITY_POLICY.md; no new ADR.
- Target phase/environment: controlled pilot preparation; runtime and publication acceptance, not hosted readiness or legal certification.

## Change summary

- Add buyer-only pending-offer withdrawal using the existing cancelled state and shared inventory lock order; duplicate withdrawals are idempotent.
- Require a trimmed 1–1,000-character seller rejection reason; commit decision and audit atomically and project only the first reason into party-scoped history.
- Add sent-offer confirmation/history and seller explanation UI with retained form state; distinguish missing legacy/automatic reasons.
- Label negotiation external on offer entry/register and publish a versioned customer limitations page discoverable from workspace navigation.
- Publish release naming, semantic compatibility, changelog, notice/migration and security-exception rules.
- Mark the previously accepted SEC-009/015 and ARC-016/017 complete:92/343 (26.8%).

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: permission alone does not replace buyer/seller authority. Withdrawal and competing terminal decisions serialize on existing inventory locks; it cannot cancel an accepted contract. Rejection reason is explicitly shared with the buyer, bounded and rendered as text. Audit failure rolls back business state. History is immutable through application decisions; no WORM/database-admin tamper resistance is claimed. Existing full resource/field security gaps remain separate.

## Database and deployment

- Migration required: no; cancelled status and indexed audit history already exist.
- Backfill/lock implications: no backfill. Withdrawal uses existing holding→listing→offer lock order; it does not reserve/release inventory before acceptance.
- Rollback or compensation: revert UI/client/API/query together; retain historical cancelled offers and audit reasons. Never revive accepted or terminal offers as rollback compensation.
- Configuration/secrets changed: none; no dependency or external service added.
- Compatibility: seller rejection now requires reason. Older empty-body clients receive controlled 400 without mutation and must use the bundled client. This pre-pilot request tightening is explicitly recorded in CHANGELOG.md; it is not a silent stable-API change. New withdrawal route uses the existing cancelled state.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 1,080 API cases, six HTTP regressions, workspace/browser types, both builds, quality, checked 196-route authorization inventory and backlog checks. New withdrawal and expanded integrity suites compile strictly. Seven new native withdrawal cases cover ownership, terminal states, duplicate requests, acceptance race and audit rollback; rejection regressions cover visibility, state/audit safety and concurrency. Actual Docker/browser runtime remains exact-commit release and required CI acceptance. Add passing SHA/date and CI result before merge; update relevant boxes after pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: confirmation precedes withdrawal; reason field is labelled and blank submission disabled. Known limitations version 2026-10-14.1 describes recorded payments, partial assurance/language and absent provider marketplace without implying guarantees. External messages cannot amend recorded trades. Full accessibility/visual review and hosted service levels are not claimed.

## Follow-up work

- TRD-015/016 and LNG-004: legal agreement/signature/versioned commercial acceptance and authoritative document language.
- SEC-019 and hosted ENV/OPS/PER/SAF gates: verified private security contact, infrastructure/operator evidence and independent review.
- SVC backlog: verified provider selection, service awards and fulfillment are future work.
- Apply the published release/deprecation and limitations-review policies to each future pilot release; adoption does not imply those future events already occurred.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Close TRD-010/011/012 and GOV-007/009/010 after integrated release/CI and founder review/merge acceptance. Current 92/343 (26.8%); six closures yield 98/343 (28.6%). Core pilot11/28 (39.3%) and provider-inclusive11/40 (27.5%) remain unchanged; local engineering closure is not hosted pilot approval.
