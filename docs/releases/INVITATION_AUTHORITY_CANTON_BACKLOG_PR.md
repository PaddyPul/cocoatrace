# Revalidate invitation writes and integrate Canton research backlog

Resend and revoke previously trusted the permissions captured by HTTP authentication. They now serialize with access lifecycle decisions and recheck live identity, session, roles and passkey assurance inside the mutation transaction. Platform scope comes from current roles; a verified, unsuspended target organization is locked before changing an invitation. Denied writes roll back before token rotation, audit or email submission.

Add 16 unit regressions and six native regression definitions for removed rights, stale platform scope, expired sessions, suspension, nondisclosure and rollback. The native cases extend the existing invitation register suite and run through the normal full release. There are no migrations, dependency or configuration changes.

Import BT-CANTON-001 research and track CT-00–CT-18 in the master backlog. Map actual integration boundaries, including existing agreement snapshots/acknowledgements; call out pre-offer versus post-contract timing, hash compatibility, separate ledger token authority and incomplete mapping schema. Canton remains optional P2 with no runtime implementation. The denominator expands from 343 to 362; accepted completions remain 169 (46.7%). Core/provider gates are unchanged.

Validation by author: 1,588 API unit cases pass; corrected focused invitation tests pass 28/28. Workspace/API/web/browser types, API build, quality/controller-boundary checks, backlog tests and strict standalone compilation of the native suite pass. Docker is unavailable on the author host: native database/browser execution and full verify:release remain pending. Add the local passing candidate SHA/date and required CI results before merge.

Remaining scope: durable invitation outbox and complete mutation/event inventory (ARC-013), initial issuance live-authority review, real-provider inbox acceptance (IDN-021), and independent hosted security/operations evidence. This PR does not close those items or claim Canton verification.

Rollback: revert this commit; preserve invitation/audit records and existing volumes. No down migration or destructive database reset.
