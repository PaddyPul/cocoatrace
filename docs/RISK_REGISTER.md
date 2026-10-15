# Pilot risk register

Reviewed: 2026-10-15. Next review: 2026-10-22. Coordinating owner: Albert M. Pul (founder / repository maintainer).

These are open operating risks, not accepted exceptions or evidence of hosted readiness. The owner coordinates review; independent review and operational staffing remain separate. Update likelihood, impact, mitigation and next date when evidence or scope changes. Run npm run risk:report to identify a due review; time alone never closes a risk.

| Risk | Likelihood | Impact | Status | Mitigation / evidence | Backlog |
| --- | --- | --- | --- | --- | --- |
| RSK-001 — Hosted isolation and private storage | high | critical | open | No real customer pilot until isolated private DB/storage, HTTPS and recovery evidence pass. Continue synthetic demo only. [Evidence](pilot-gates.json) | ENV-004, ENV-005, ENV-006, UPL-002, OPS-002 |
| RSK-002 — Privileged account or tenant boundary compromise | medium | critical | open | Live session/MFA and resource policies are implemented; complete independent resource/field and deployed privilege review. [Evidence](security/AUTHORIZATION_MATRIX.md) | SEC-006, SEC-018, SAF-004 |
| RSK-003 — Payment reference fraud or unsafe dispatch | high | high | open | Counterparty receipt verification and dispatch/document gates; no bank/escrow guarantee. Verify external payment details. [Evidence](security/THREAT_MODEL.md) | PAY-014, TRD-015 |
| RSK-004 — False or expired assurance claims | medium | high | open | Separate declaration and independent review; enforce subject/crop/date scope, revoke stale claims and inspect contradictions. [Evidence](../api/src/modules/trust/assessment.ts) | DAT-005, DAT-006, DAT-010 |
| RSK-005 — Incomplete recall reach or unsafe returned stock | medium | critical | open | Retain inventory holds and recovery controls; prove recipient completeness and operating escalation before live pilot. [Evidence](security/THREAT_MODEL.md) | RCL-001, OPS-010 |
| RSK-006 — Resource overload or provider outage | high | high | open | Bounded reads/uploads and durable retries exist; validate representative hosted capacity and external alert ownership. [Evidence](pilot-gates.json) | PER-001, OPS-006 |
| RSK-007 — Zero-budget hosting cannot satisfy pilot gates | high | high | open | No paid plan or trial assumed. Keep synthetic rehearsal until secure free resources are evidenced or founder changes budget. [Evidence](runbooks/FREE_STAGING_PLAN.md) | BST-001, ENV-004 |
| RSK-008 — Participants rely on unsupported commercial or logistics features | medium | high | open | Versioned limitations, external-negotiation guidance and explicit trade terms; provider marketplace remains future scope. [Evidence](pilot/KNOWN_LIMITATIONS.md) | TRD-015, TRD-016 |

Source: risk-register.json. After editing, run node scripts/risk-register.mjs --write; commit the JSON and this view together. Reassess before each real pilot admission and record the review decision; automated checks cannot accept a risk on the founder’s behalf.
