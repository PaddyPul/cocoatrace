# Durable invitation email delivery

Tracks ARC-013 / IDN-021 / SEC-006 / OPS-010. Candidate implementation; native/full-release and hosted acceptance are separate evidence.

## Guarantees and scope

Team creation, resend and first-admin organization approval insert an invitation-generation outbox record and audit in the same PostgreSQL transaction as the business change. Outbox/audit failure rolls the whole change back. HTTP handlers may attempt an immediate drain after commit; failure there returns an honest pending state, while the scheduled worker can recover without the original process or caller token.

Each generation is unique by `(invitation_id,token_hash)`. Retries keep that generation; explicit resend rotates the bearer token and supersedes/scrubs old pending work. Enqueueing a duplicate generation never resets a successful submission status. Acceptance and explicit revoke scrub pending credentials transactionally. Other existing access lifecycle revocations are rechecked and scrubbed by the worker.

Before submission, the worker locks current issuer identity, roles, verified/unsuspended organizations, invitation and claim. It checks the generation, bound recipient digest, expiry, acceptance and revocation, plus current issuer scope and role assignment policy. Logout/session expiry after a committed authorization does not cancel the invitation; issuer suspension, loss of invitation authority, target suspension, cancellation or token replacement prevents future submission. Session and fresh-passkey requirements are enforced at the initiating mutation, including first-admin review. Operator retry requires current platform authority and audit; it does not send directly.

SMTP submission is **at least once**. A crash or lost acknowledgement after relay acceptance can cause a duplicate email. `sent` means relay acceptance recorded, not inbox arrival, identity verification or customer acceptance. A database/network failure during submission remains an incomplete attempt until reconciliation/retry, never invented success. Current authorization rows and the lifecycle decision lock remain held during the bounded SMTP exchange; slow SMTP can delay lifecycle writes. Monitor provider latency and investigate repeated retries rather than increasing timeouts without review.

## Configuration and keys

`INVITATION_DELIVERY_KEY` is a dedicated CSPRNG-generated 32-byte key encoded as exactly 64 hex characters. Required whenever `IDENTITY_EMAIL_ENABLED=true` and `EMAIL_DRIVER=smtp`. No production default is provided. Do not reuse session or evidence signing keys. Startup validates format, presence and separation without printing key values.

The ordinary demo remains email-disabled by default and needs no key. Disabled-mode invitations are recorded as suppressed without recoverable bearer material; enable/configure SMTP then explicitly resend if delivery is intended. The browser release fixture uses its own synthetic key. The local Mailpit override requires a key in the local environment.

Bearer tokens are encrypted with AES-256-GCM, fresh nonce and authenticated context binding schema, invitation ID, token hash and recipient digest. Only ciphertext/key fingerprint and recipient digest are retained in the private outbox; no plaintext bearer links or recipient email is duplicated there. Recipient digests are sensitive internal correlation data, not anonymization. No raw tokens/keys/recipients/provider text enter worker logs or audits.

Keep this key in the deployment secret store and in the separately secured recovery material for the private database. A database-only restore cannot recover queued credentials if the key is lost. The current implementation supports one active key, not a key ring. Do not replace it while any row retains `token_ciphertext`; restore the original key or review/reissue affected invitations before rotation. Credential/key errors are terminal and are not blindly retried.

Success, suppression, replacement and explicit cancellation clear recoverable credentials. A bounded maintenance sweep also clears obsolete/expired credentials, including terminal attempts, even when SMTP is disabled, while the worker runs. A stopped server cannot enforce a deletion deadline; include outbox/secret recovery and retention in hosted operational acceptance.

## Worker and operations

`invitation_email` runs with the existing tracked operations scheduler every 15 seconds, under deployment ownership. Claims have five-minute leases, at most eight attempts, bounded batches and linear backoff capped at an hour. Expired claims recover; live claims cannot be stolen. Row locks and claim tokens prevent concurrent submissions for one claimed generation. Independent immediate drains use the same claim protocol.

The operations page exposes the fifth metadata-only queue (`invitation`) and sixth job, plus terminal retry review. Existing routes `/operations/email/:queue/dead` and `/operations/email/:queue/:id/retry` now accept `invitation`; they do not return token/ciphertext, email or provider diagnostics. Only known transient/lease failures with unsubmitted, unleased, recoverable current generations may be requeued. Expired/revoked/accepted/superseded or corrupt work is refused. The worker still rechecks recipient/issuer eligibility after a reviewed retry.

Safe errors: `SMTP_SUBMISSION_FAILED`, `FINAL_LEASE_EXPIRED`, `INVITATION_KEY_UNAVAILABLE`, `INVITATION_CREDENTIAL_INVALID`. Unknown provider errors are redacted. Retry can duplicate email: review original generation and provider incident first. Key/ciphertext failures require investigation and usually a reviewed explicit resend, not arbitrary SQL status updates.

## Deployment and historical invitations

Migration 052 adds the empty outbox and indexes and extends the operations job constraint. Existing migration files and invitation hashes are unchanged. There is no mass backfill or unsolicited replay: historical hashes cannot recreate tokens. Existing links continue to work; use the existing authorized Resend action for a historical invitation that needs a fresh deliverable token.

Apply migrations through normal hardened API startup. Do not run npm inside that production image or reset existing volumes. Full release checks include migration fresh/upgrade, native database tests, browser journeys, scanner/storage and recovery.

Rollback: stop new workers/API first, retain the database and encryption key, and prefer a forward repair. Reverting application code does not delete the outbox; old code cannot drain or expire its credentials. If reverting the operations UI, remove only the new `operations_job_status` row after stopping its worker, so old clients do not receive an unknown job name. Do not delete pending queue rows to make a rollback appear healthy. Migration down refuses nonempty history. Restore the new worker or perform a reviewed recovery before leaving credentials past retention.

## API and UX contract

Invitation create/resend and access-approval responses may return `emailDelivery: pending | sent | failed | suppressed`. Request-access verification emails keep their existing synchronous contract; they are not part of this outbox. `pending` is displayed as queued, never as disabled or sent. The invitation register retains the existing `email_delivery_status` values (`pending`, `sent`, `failed`, `suppressed`). Fresh reads show durable state. No ledger, payment or legal-signature claim is introduced.

## Verification still required

The native invitation-delivery suite covers commit recovery, atomic rollback, duplicate enqueue, competing workers, expired/live leases, bounded attempts, unknown outcomes, token replacement, revoke/accept, issuer permissions, recipient binding, disabled delivery, credential failures, audited retries and first-admin approval. Browser definitions cover the new operations queue and reviewed recovery. These definitions are not evidence that Docker, real SMTP/inbox or hosted restore has passed. Run the committed-candidate full release and retain its matching SHA before push/merge. ARC-013 remains partial for complete mutation/event inventory; IDN-021 remains partial for real staging inbox acceptance.
