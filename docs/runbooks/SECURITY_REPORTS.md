# Private vulnerability intake and triage

Backlog: SEC-019. Policy is written; private intake activation and monitoring evidence remain required. This document does not close the item by itself.

## Activate before pilot

The repository owner must enable GitHub private vulnerability reporting in repository security settings, or configure another private channel and update `SECURITY.md` with its verified address. This change has no authenticated GitHub settings evidence and does not enable a feature remotely.

Record a primary and backup intake owner, their accepted monitoring arrangement, and the timezone and coverage limitations in a private operations record. With an authorized second account, submit a harmless test report containing no vulnerability or customer data. Confirm it is visible only to intended maintainers, reaches the assigned owner, and receives a private acknowledgment. Record the test date, private report reference and owner acceptance privately. Add only a redacted pass/fail and date to release evidence. Then remove the unverified-channel wording from `SECURITY.md` after review. Do not claim SEC-019 complete until all these steps have evidence.

## Handle a report

1. Acknowledge privately, targeting two business days. Assign a case identifier and owner. For a suspected active compromise, escalate immediately to the designated incident owner; if that owner is not yet assigned, the repository owner coordinates containment and records the ownership gap.
2. Triage within five business days where possible. Record affected versions, affected boundaries, reproducibility, impact, severity rationale and next update date. Do not dismiss a report because a scanner or release gate passes.
3. Reproduce only in an isolated environment with synthetic tenants. Do not request production credentials or raw customer evidence. If sensitive material arrives accidentally, restrict access, avoid forwarding it, arrange removal from unnecessary copies and assess whether rotation or incident handling is required.
4. Track the fix in a private advisory or restricted case. Link public work only after it cannot expose an unmitigated exploit. Review authorization, retries, audit behavior, data correction and deployment implications as applicable. Verify a regression and the exact release candidate; require independent review for sensitive boundaries.
5. Agree a disclosure date or update schedule with the reporter. Preserve any embargo until the agreed time unless ongoing harm requires earlier coordinated notice. Never promise an indefinite embargo or a fixed remediation deadline before assessment. Notify affected operators privately using verified contacts when action is needed.
6. Close after recording the fixed release or mitigation, validation evidence, deployment confirmation and reporter notification. Publish a redacted advisory when appropriate. An accepted exception needs an accountable owner, rationale, compensating control and review date; it is not a fix.

## Evidence and access

Keep original reports, triage decisions, acknowledgments, fix references and disclosure decisions in the restricted case, accessible only to assigned maintainers and incident responders. Do not copy reproduction secrets into public Git history, CI artifacts, backlog notes or ordinary support logs. Use redacted identifiers in general release evidence.

Retain the minimum case evidence needed for remediation, incident review and applicable obligations. The owner must document an access review and retention/deletion decision at closure; no automatic deletion schedule or statutory retention period is invented here. Preserve records needed for an ongoing investigation, and remove temporary reproduction data and credentials when no longer needed.

## Operational limits

This policy supplies process, not a monitored mailbox, incident rota, external notification service or legal safe-harbor agreement. Hosting, on-call ownership and breach notification obligations require their own acceptance. Recheck intake after repository ownership, permissions or contact changes.
