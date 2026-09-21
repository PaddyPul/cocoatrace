# Production readiness

The repository now contains a deployable pilot architecture, but production authorization is an operational decision, not a label created by a successful build. Use this document as the release gate.

## Implemented controls

- HttpOnly, same-site browser session cookie; bearer tokens remain available to non-browser API clients.
- Browser-origin validation for state-changing cookie requests.
- Rate limits on login and invitation acceptance.
- Single-use, seven-day invitations and attributable pilot accounts.
- Role-aware onboarding stored per user.
- Explicit pilot feedback, stored separately from traceability records.
- Readiness and liveness endpoints.
- PostgreSQL TLS and pool configuration.
- Helmet security headers, exact-origin CORS and permission checks.
- Pull-request CI for API tests and both production builds.
- Deterministic readiness advice with an optional, non-authoritative AI narrative.

## Required deployment configuration

Run `npm run check:production` in the release environment. It rejects missing URLs, an insecure or default JWT secret, non-HTTPS public URLs, insecure cookies, and partial AI configuration.

Set at least:

- `DATABASE_URL`
- `JWT_SECRET` (unique and at least 32 characters)
- `WEB_URL` and `PUBLIC_WEB_URL` (HTTPS)
- `COOKIE_SECURE=true`
- `DATABASE_SSL=true` when required by the managed database
- `APP_VERSION` to the deployed commit SHA
- both `OPENAI_API_KEY` and `OPENAI_MODEL`, or neither

Use `/health/live` for process health and `/health/ready` for traffic readiness.

## Release-blocking external checks

These cannot be proven inside the repository and must be signed off in the hosting environment:

- Managed database backups, point-in-time recovery and a successful restore drill.
- Object storage for evidence with encryption, access control, retention and malware scanning. The local upload directory is suitable only for development/pilot staging.
- Central logs, error monitoring, uptime alerts and an incident owner.
- Secret manager and key rotation; no production secret in GitHub or Docker Compose.
- TLS termination, secure DNS and tested cookie behavior on the final domain.
- Data processing agreements, retention/deletion policy and privacy notice.
- Independent authorization and tenant-isolation test against every API resource.
- Load test using realistic lot graphs and evidence volumes.
- Named incident-response and recall escalation contacts.

Until those checks pass, call the environment **pilot staging**, not production.

## Safe release sequence

1. Deploy a fresh staging database and apply `db/schema.sql` through the normal migration job.
2. Do not run `db/seed.sql` in production.
3. Run API tests, API build, web build and `npm run check:production`.
4. Create the first platform administrator through a controlled one-time operation.
5. Create one pilot organization and issue individual invitation links.
6. Execute the five-task pilot and a quantity-aware tabletop recall.
7. Perform the tenant-isolation test and backup restore drill.
8. Promote the exact tested image and commit SHA.
