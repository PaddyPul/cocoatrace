# Invitation delivery follow-ups (ARC-013 / IDN-021)

The durable-invitation candidate implements the previously planned outbox for all three producers: team issuance, resend and first-admin organization approval. It also revalidates initial issuance/approval authority and adds recoverable encrypted credentials, generation/recipient binding, bounded claims/retries, worker status, metadata-only backlog/terminal review, and audited operator recovery. See [the runbook](../runbooks/INVITATION_DELIVERY.md).

Founder reports full release passed and merged on 2026-10-22; main PR #140 contains the corrected native fixtures and Vitest 4.1.12. This invitation engineering slice is accepted. Real staging inbox and hosted recovery acceptance remain separate.

Remaining after acceptance:

- **ARC-013:** Finish the explicit whole-write mutation/audit/event inventory. The accepted critical-flow audit matrix and this outbox must not be generalized into universal atomicity.
- **IDN-021 / ENV-004–014:** Verify registration verification email, first-admin invitation, team invitation/resend and password reset arrive in the intended real staging inbox. Record revoked/expired/reused-link behavior, key recovery and private database restore evidence. Provider relay acceptance is not inbox evidence.
- **OPS-006 / OPS-010:** Hosted worker ownership, external alerts, incident owner and key/retention/recovery rehearsal. Existing local scheduler/status/retry implementation is not named operational ownership.
- **SEC-006 / SAF-002:** Review hosted secret storage, key recovery, least-privilege DB access and internal digest exposure; document latency/lock impact of slow SMTP. No key-ring/hot rotation is claimed.

No automatic historical replay is required or implemented: old hash-only invitations need explicit authorized resend if delivery is intended. Email-disabled environments never retain raw/recoverable new credentials merely to simulate delivery.
