# Identity email delivery runbook

This runbook covers transactional email used for account verification,
organization invitations and password recovery. It does not cover marketing
email.

## Safety boundary

- Identity flows are off unless `IDENTITY_EMAIL_ENABLED=true`.
- `development` delivery suppresses messages and logs metadata only. It never
  logs recipients, message bodies, verification links, invitation links or
  password-reset links.
- Staging and production refuse to start with identity email enabled unless the
  SMTP adapter, authenticated relay credentials and verified TLS are configured.
- The sender accepts identity links only when their origin exactly matches
  `PUBLIC_WEB_URL`. This prevents host-header or caller-controlled links from
  being placed into account-security email.
- SMTP acceptance means the configured relay accepted the message. It does not
  prove inbox delivery. Provider bounce and complaint handling must be connected
  before a broad customer launch.

## Configuration

Use environment-scoped secrets. Never commit relay credentials.

| Variable | Required | Purpose |
| --- | --- | --- |
| `IDENTITY_EMAIL_ENABLED` | Yes | Enables identity flows that depend on email delivery. |
| `EMAIL_DRIVER=smtp` | Deployed environments | Selects real delivery. |
| `EMAIL_FROM` | SMTP | Verified envelope/from address, such as `identity@example.com`. |
| `SMTP_HOST` / `SMTP_PORT` | SMTP | Relay hostname and port. Port 587 with STARTTLS is the default. |
| `SMTP_SECURE` | SMTP | Use implicit TLS, normally for port 465. |
| `SMTP_REQUIRE_TLS` | Deployed environments | Require STARTTLS when implicit TLS is not used. Must remain `true`. |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | Deployed environments | Verify the relay certificate. Must remain `true`. |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP | Environment-scoped relay credentials. |
| `SMTP_AUTH_METHOD` | Optional | `plain` (default) or `login`, selected to match the relay. |
| `SMTP_CONNECTION_TIMEOUT_MS` | Optional | Connection and response timeout; default 10 seconds. |

For local development, leave `IDENTITY_EMAIL_ENABLED=false` and
`EMAIL_DRIVER=development`. If demo/test code needs to display a one-time link,
it must do so through an explicit demo/test-only interface—not through logs.

## Deployment verification

1. Verify the sender domain and `EMAIL_FROM` with the provider.
2. Configure SPF, DKIM and DMARC for the sender domain.
3. Store SMTP credentials in the environment secret manager.
4. Run `npm run check:production` and the API configuration/unit test gates.
5. From staging, send one verification, invitation and password-reset message
   to controlled test inboxes.
6. Confirm each link uses the exact staging `PUBLIC_WEB_URL`, is single-use and
   expires as designed by the identity workflow.
7. Confirm application and centralized logs contain no URL tokens or message
   bodies.
8. Record relay message IDs, delivery time and any bounce without copying the
   security link into the incident record.

## Failure handling

If SMTP is unavailable or rejects authentication:

1. Treat issuance as not delivered; never report successful delivery internally
   merely because a token was stored.
2. Preserve the public endpoint's non-enumerating response behavior.
3. Alert the pilot incident owner using counts and categories only. Do not place
   recipient addresses or links in alert labels.
4. Check relay status, credential expiry, TLS certificate validity and provider
   rate limits.
5. Rotate a suspected credential in the secret manager and restart/redeploy the
   API. Do not print the old or new credential.
6. After recovery, issue a new single-use token. Do not resend an expired or
   previously disclosed link.

## Provider cutover and rollback

Test new SMTP credentials in staging first. Production cutover consists only of
changing environment-scoped SMTP configuration and redeploying the same tested
artifact. To roll back, restore the prior valid secret version and redeploy. Do
not fall back to the development adapter in staging or production; configuration
validation intentionally blocks that downgrade while identity email is enabled.

## Integration API

Backend identity slices should depend on the `EmailSender` port or call one of
the focused helpers from `api/src/services/emailSender.ts`:

- `sendVerificationEmail({ to, verificationUrl, recipientName?, organizationName? })`
- `sendInvitationEmail({ to, invitationUrl, recipientName?, organizationName? })`
- `sendPasswordResetEmail({ to, resetUrl, recipientName? })`

The helper must be called only after the corresponding hashed, expiring token is
persisted. Callers must not log or return the raw token outside explicit demo or
test behavior.


## Implemented submission and retry behavior (2026-10-01)

- Approval commits the organization/invitation before submitting the email. Failed
  submission does not undo approval; on the Approved applications tab, use
  **Resend admin invitation** to rotate that invitation, without reapproving.
- Invitation creation and resend return `emailDelivery`: `sent`, `suppressed`,
  or `failed`. `sent` means relay acceptance, never proof of inbox delivery.
  Persistent `email_delivery_status` records the last submission outcome;
  historical rows start `unknown`. Resend resets it to `pending`.
- Team creation serializes requests for the same address and rejects duplicates.
  Failed submission leaves one invitation visible for manual retry.
- Verification failure leaves the application pending. Resubmit the same details
  to rotate its token on the same application. Pending-review applications cannot
  be replaced. Concurrent retries can invalidate the earlier email; use the newest.
- Resend rotates the token and extends expiry. It can renew an expired invitation,
  but cannot resurrect a revoked or accepted one. A slow send cannot overwrite
  a newer token's delivery outcome.
- Reset submission stays non-enumerating. Internal security events distinguish
  sent, suppressed and failed submission. Request another reset after provider
  recovery; old reset tokens are invalidated.
- No token-bearing email bodies are persisted. There is no automatic background
  retry worker in this slice. ARC-014 remains the durable outbox follow-up.

## Local inbox test

Use `docker-compose.email-test.yml` alongside the base compose file. It enables
SMTP only for the existing local demo API and disables the demo login UI.
The Mailpit inbox is bound to `127.0.0.1:8025`; its SMTP port is not published.
It captures email locally and **does not deliver to Gmail or other real inboxes**.
No application data volumes are reset. Do not use this override for deployment.
Mailpit test authentication flags follow its official SMTP documentation:
https://mailpit.axllent.org/docs/configuration/smtp/.

See `docs/releases/IDENTITY_EMAIL_DELIVERY_WINDOWS.md` for the complete Windows
application, testing, push, merge and pull workflow.

## External gates still open

A provider and domain are not provisioned by a bundle. Before calling IDN-021
complete, record staging SMTP credentials in the secret manager, validate the
sender domain, use HTTPS/PUBLIC_WEB_URL for staging, and demonstrate inbox arrival
for every identity email using owned addresses. Record bounced/rejected cases
and operational alerts. Provider webhooks and the durable outbox are follow-up
work; do not equate a local capture test with production email readiness.
