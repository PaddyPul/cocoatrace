# PR title

feat: add bounded team administration and privileged access reviews

# PR body

## Outcome

Organization administrators can review team roles, assign bounded permissions and deactivate another member with current-password confirmation and audited session revocation. Platform administrators can record periodic privileged-access reviews tied to the exact roster they reviewed, with unknown activity kept explicit.

## Tracking

- Backlog ID(s): IDN-016, IDN-017, IDN-019 closure targets.
- Issue/ADR: docs/runbooks/TEAM_ACCESS_REVIEW.md.
- Target phase/environment: local/CI acceptance before pilot; hosted operator exercises remain separate.

## Change summary

- Add server-paged team member search and bounded buyer/supplier administrator, member and viewer roles; preserve existing invitations.
- Recheck live authority, password and required passkey assurance transactionally. Reject self changes, foreign targets, custom/wildcard escalation and protected organizations; revoke target sessions and recovery artifacts atomically with audit.
- Add complete privileged roster reporting, explicit unknown/stale retained evidence, exact snapshot conflict checks, immutable review receipts and30-day next due.
- Add role policy, native transaction/isolation and browser form-preservation regressions; reconcile accepted branding work in progress counts.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: team changes require bounded live administrator permissions; platform reviews require wildcard authority. Private responses are no-store. Foreign membership is nondisclosing. Mutations use access-decision locking and audit transactions. No passwords or session tokens returned. Management above500 members and review above500 privileged accounts refuse complete decisions rather than silently truncate. No automatic clean-access certification or real outgoing message is introduced.

## Database and deployment

- Migration required: yes,039_team_member_management and040_access_reviews; frozen migrations unchanged.
- Backfill/lock implications: add member.manage to existing customer administrator roles and insert bounded member/viewer roles; create review table. Management uses serialized access decisions and bounded row locks.
- Rollback or compensation: reviewed forward correction; do not reset data. Earlier images may reject newer migration ledgers. Restore access only through separately reviewed lifecycle controls.
- Configuration/secrets changed: none; no dependency, paid service, project/volume/domain rename.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author1,160 API unit cases, quality, workspace/browser types, API/web builds, native suite compilation,13 release-runner,9 frontend transport/environment and6 locale cases passed; migration/authorization/branding/backlog/risk checks passed. Native suites and E2E definitions supplied and compile; Docker unavailable and Chromium blocked by host socket permissions. Exact-commit full release and required CI remain mandatory before merge. Add candidate SHA and CI URL and check runtime boxes after passing.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: explanation stays independent of ordinary list refresh. No retained activity means unknown, not proven inactivity. Receipt recording does not resolve findings. New role grants remain limited to existing buyer/supplier administrators; legacy ordinary accounts do not automatically become administrators.

## Follow-up work

- SAF-004/IDN-018: independent reviewer and emergency lifecycle exercises.
- ENV/OPS: hosted acceptance and current CI evidence archive.
- LNG/UX: complete workflow translations and human accessibility review.
- Logistics service marketplace and remaining pilot gates remain open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted122/343 (35.6%); target125/343 (36.4%) after full release/review/merge. Core11/28 (39.3%), provider-inclusive11/40 (27.5%) unchanged. These are closure counts, not valuation or safety probabilities.
