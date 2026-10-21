# Remaining invitation delivery work (ARC-013 / IDN-021)

The accepted atomic audit slice prevents email submission when mutation/audit rolls back, but sends after commit. A crash between commit and submission loses delivery. This candidate adds live authority checks to resend/revoke only; durable delivery and initial-issuance revalidation still need the following slice. Do not mark ARC-013 or IDN-021 complete.

## Required implementation slice

- Inspect both `api/src/services/invitationIssuance.ts` and the organization approval workflow, including its initial administrator invitation path. Cover every producer; initial approval must not keep a separate best-effort send.
- Add a forward migration for an outbox keyed by invitation and immutable token generation. Persist intent in the same transaction as invitation, audit and approval when applicable. Keep applied migrations frozen and register the new digest.
- Design recoverable bearer delivery without storing raw tokens, links or plaintext recipient data in generic job logs/audits. Current invitations store only a token hash, so an outbox ID alone cannot recreate the existing email after restart. Review a dedicated encryption key with authenticated ciphertext, explicit rotation/key ID and bounded payload retention, or a reviewed derivation protocol. Never reuse a session JWT as an encryption credential or silently keep plaintext in JSON.
- Worker must check live invitation generation, unaccepted/unrevoked/unexpired status, verified unsuspended target, intended email and issuer authority policy before submission. Resend rotates generation atomically; stale queued work must not overwrite newer delivery status. Revocation/acceptance invalidates pending work. Define what happens when the original inviter loses access after the invitation was authorized.
- Use bounded claims with leases, maximum attempts/backoff and restart recovery; store safe error codes. Handle SMTP acceptance followed by connection/process loss honestly: at-least-once may duplicate email, and inbox arrival is not proven by relay acceptance.
- Add worker status, pending/terminal queue visibility and audited retry controls. Preserve demo/test links only in their existing allowed environments; production responses must not expose bearer links. Configuration disabled must not generate retry storms or claim successful delivery.
- Review and revalidate initial invitation creation's live session, role assignment and target scope in the same transaction; resend/revoke changes in this bundle must not be interpreted as fixing every issuance path.

## Acceptance matrix

Native tests: audit failure leaves no invitation/outbox; enqueue failure rolls everything back; crash after commit recovers; two workers do not concurrently claim; timeout/lease expiry preserves honest retry state; resend supersedes stale generation; accepted/revoked/expired/suspended/role-removed cases refuse new sends; ciphertext tampering and unknown key fail closed without leaking payload; older send cannot overwrite a newer generation; terminal retry has current administrator authority and an atomic audit.

Browser coverage: queued versus submitted versus failed statuses, retry without duplicate account/organization, revoked/rotated link rejection. Full committed-candidate `npm run verify:release` must pass. Real staging provider/inbox tests remain separate from synthetic tests.
