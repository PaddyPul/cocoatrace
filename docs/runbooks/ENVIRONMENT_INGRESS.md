# Environment ingress, domains and browser boundaries

Owner: platform operator. Reviewed against repository configuration on 2026-10-15.
This is the ENV-018 configuration contract and verification runbook. It records the
implemented boundary and deployment requirements; it does not provision DNS, a
certificate, a hosting account or a live environment.

## Environment settings

Use one canonical browser origin per environment, with no path, query or fragment.
The parser currently accepts URL values more broadly; the origin-only convention
avoids disagreement between CORS, browser-origin checks and passkey identity.

| Environment                         | Actual or required browser URL                             | Cookie setting                  | Ingress and data boundary                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default local Compose               | `http://localhost:3000`                                    | `COOKIE_SECURE=false`           | `APP_ENV=demo`; web publishes 3000, API 3001 and PostgreSQL 15433 on host interfaces by default. This is not a public deployment configuration.                                                    |
| Local email + MFA overrides         | `http://localhost:3000` for both URL variables             | `COOKIE_SECURE=false` inherited | App remains local; MFA enforced and demo mode disabled; captured email inbox is `http://127.0.0.1:8025`, bound to loopback. Do not deploy these email settings.                                    |
| Dedicated synthetic preview, local  | `http://127.0.0.1:14000`                                   | `PREVIEW_COOKIE_SECURE=false`   | Separate Compose project and synthetic database; only web publishes a host port, on loopback. No outgoing app email.                                                                               |
| Dedicated synthetic preview, shared | Runner-issued `https://…trycloudflare.com`                 | `PREVIEW_COOKIE_SECURE=true`    | Runner sets both URL variables, recreates API/web and proves anonymous access is denied or reaches the provider email gate before printing the share link. Temporary demo, not staging.            |
| Staging                             | Explicit canonical HTTPS origin owned by operator          | `COOKIE_SECURE=true`            | `APP_ENV=staging`; explicit `WEB_URL`, `PUBLIC_WEB_URL`, `APP_VERSION`, secrets and deployed storage/scanner/email configuration required. DNS/TLS deployment remains an operator acceptance task. |
| Production                          | Separate explicit canonical HTTPS origin owned by operator | `COOKIE_SECURE=true`            | `APP_ENV=production`, `DEMO_MODE=false`, privileged MFA enforced. No dev credentials or Mailpit override. No production deployment is asserted here.                                               |

`APP_ENV` takes precedence over `NODE_ENV`. Thus the local production-mode Node
process is still a demo environment. `PUBLIC_WEB_URL` falls back to `WEB_URL` in
local profiles; both must be explicitly supplied in staging/production.
`WEB_URL` controls CORS, mutation origin checks and passkey identity;
`PUBLIC_WEB_URL` builds identity links and public product URLs. Keep them equal
for the supported same-origin topology. A different public hostname requires
review of those links and flows, not simply a DNS alias.

## DNS, TLS and routing contract

For an eventual hosted deployment, record the actual approved hostname, DNS
record target, TLS termination owner, certificate issuer/renewal mechanism and
expiry monitoring in the deployment record. Separate staging and production
hostnames and credentials. Confirm the DNS target belongs to the intended ingress
before pointing a domain at it. No specific hosted target is configured by this
repository, and example domains in tests are not deployed endpoints.

The supported application path is browser → web ingress → `/api/` → API.
`web/nginx.conf` listens on plain HTTP port 3000; it contains no TLS listener,
certificate, DNS setup or HTTPS redirect. It strips `/api/` by forwarding to
`http://api:3001/`. Other paths fall back to `index.html`. Vite development uses
an equivalent `/api` proxy to `http://localhost:3001`.

A hosted ingress must terminate valid HTTPS and redirect public HTTP to HTTPS
before the application; its internal upstream must be private. Expose the web
entry point only, not API, PostgreSQL, scanner, storage or an email capture inbox.
The default Compose published ports are unsuitable as-is for public hosting.
Do not infer TLS protection for internal HTTP hops from a browser padlock.

Nginx has a `10m` request-body ceiling and disables request buffering for `/api/`.
Any outer ingress must support the application's upload methods/body sizes and
appropriate bounded timeouts. A 413 generated by an outer proxy is not an
application permission failure.

## Cookies, CORS and request identity

The session cookie is `ct_session`: host-only (no Domain), HttpOnly, SameSite=Lax,
Path=/, maximum age 24 hours, and Secure controlled by `COOKIE_SECURE`.
Clearing uses the same cookie flags/path. Sibling domains do not share the cookie.
`localhost` and `127.0.0.1` are different browser hosts: use the configured one
consistently. HTTPS is required for secure cookies outside the local profile.

CORS uses exactly `config.webUrl` with credentials enabled. It is not an
all-subdomain allowlist. CORS is a browser read policy, not resource authorization.
For non-GET/HEAD/OPTIONS requests, any supplied Origin must exactly equal
`new URL(WEB_URL).origin`; foreign, literal `null`, malformed or path-bearing
origins fail. Cookie-authenticated writes with no Origin fail with
`403 ORIGIN_NOT_PERMITTED`. Bearer clients without Origin are handled under
bearer authentication and normal resource policies; adding a foreign Origin
still fails. An Authorization header does not silently fall back to cookies.

Passkey expected origin is derived from `WEB_URL`; relying-party ID is its
hostname. Changing domain is therefore an authentication migration requiring a
reviewed enrollment/recovery plan, not a cosmetic rename. Temporary tunnel
hostnames are unsuitable for persistent privileged credentials.

## Reverse proxy trust limitation

Express explicitly sets `trust proxy=false`; no environment variable enables
forwarded trust. Nginx sends Host, X-Real-IP and X-Forwarded-For, but those headers
do not grant application identity or select an allowed origin. It does not set
X-Forwarded-Proto. API IP rate budgets use `req.ip`, so proxied users can share
the ingress peer's budget. Real client IP attribution and per-client limits
behind a proxy are not yet proven by this deployment contract.

Do not enable blanket proxy trust to fix shared rate limits. A later ingress
policy must pin trusted hops, prevent direct API access, remove client-supplied
forwarded headers at the edge and test spoofing and multi-hop behavior. Preserve
the current fail-closed Origin and tenant controls during that change.

## Safe checks and troubleshooting

These checks do not mutate app data or disclose secrets. Avoid posting complete
`docker compose config`, environment dumps, cookies, PINs, identity URLs with
tokens or provider gate query strings in support logs.

1. Open the canonical configured browser URL. Inspect Network for same-origin
   `/api/health/ready` success. An API health response alone does not prove email,
   passkey, tenant authorization or ingress policy.
2. In browser storage, inspect cookie **flags and hostname only** after signing
   in. Inspect a write request's Origin and compare to the canonical `WEB_URL`.
   Do not copy cookie values. A 403 Origin error usually means host/scheme/port
   disagreement; do not disable the origin guard.
3. For local Compose, `docker compose -f docker-compose.yml -f
docker-compose.email-test.yml -f docker-compose.mfa-test.yml ps` checks
   service state without dumping credentials. Use `http://localhost:3000`.
4. For dedicated preview, `npm run demo:preview:status` and
   `npm run demo:preview:check` inspect the dedicated workspace. Share via
   `npm run demo:preview:share -- "allowed@example.com"` only with synthetic data.
   The runner validates the cloudflared email-gate capability and stops sharing
   if the external denial/gate check fails. A new tunnel URL requires its runner
   update; do not reuse stale URLs. The provider sends the gate email; app email
   remains disabled. Keep PC/terminal running; Ctrl+C or the two-hour timer stops
   sharing. `npm run demo:preview:stop` stops the project and retains data.
5. For a future approved hosted URL, inspect DNS using
   `Resolve-DnsName <approved-host>` and HTTPS headers using
   `curl.exe -I https://<approved-host>/`. Confirm certificate hostname, validity,
   HTTP redirect and private upstream exposure separately in the deployment
   record. A successful HEAD alone proves none of those resource boundaries.
6. If shared preview gets an email gate followed by Bad Request, verify the
   currently printed URL, provider cookie acceptance and that runner readiness
   passed. Report sanitized status/origin only. Do not bypass the email gate.
7. If 429 appears for several users behind ingress, check shared peer-budget
   effects before blaming credentials. If passkeys fail after a hostname change,
   compare configured origin/RP identity; use the reviewed recovery process.

## Evidence and remaining deployment acceptance

Source anchors: `api/src/config/env.ts`, `api/src/app.ts`,
`api/src/controllers/authController.ts`, `api/src/middleware/security.ts`,
`api/src/modules/mfa/service.ts`, `web/nginx.conf`, `web/vite.config.ts`,
`docker-compose.yml`, email/MFA/preview overrides and `scripts/demo-preview.mjs`.
Existing security middleware, configuration and preview runner tests cover the
configured software boundary. This document adds no runtime verification claim.
Record actual DNS/TLS checks, anonymous edge denial, authenticated origin/cookie
flows, private upstream exposure and correctly stamped deployment diagnostics
before accepting a hosted environment. ENV-018 documents configuration; it does
not close hosting, ingress trust, performance or production readiness gates.
