# Automated browser regression

Backlog: QLT-021. Run from the repository root:

```powershell
npm ci
npm run typecheck:browser
npm run test:browser:docker
```

Use Docker Desktop with Compose v2. No application startup, manual fixture
creation or real email address is required. The runner downloads the pinned
Playwright Chromium version on the first run, builds API/web images, prepares a
dedicated database, creates one test-only reviewer and captures actual SMTP
messages in Mailpit. It drives the built frontend through Chromium, follows
captured email links and cleans up the dedicated containers afterward.

## Current coverage

| Journey | Assertions |
| --- | --- |
| Buyer registration | Request access, verify email, reviewer approves, administrator accepts invitation, onboarding, sign-out, protected redirect, sign-in |
| Supplier registration | Same journey with the supplier role |
| Team invitation lifecycle | Create, resend, reject superseded link, revoke, reject revoked link, accept a fresh invitation and sign in |
| Password reset | Captured reset email, one-use link, previous session revoked, old password rejected visibly, new password works |
| Password change | Current session remains valid; another browser session is revoked |
| Verification expiry/retry | Expired link rejected; retry sends a new link; old and reused links remain rejected |

Business actions go through the UI. The expiry test alone changes a matching
fixture's timestamp through PostgreSQL rather than waiting for expiry. It is
guarded by an exact test database name and loopback host. Helper modules own
identity setup, inbox polling, environment validation and reporting separately.

## Isolation and safety

The Compose project is `cocoatrace-browser-tests`; it uses no application
database or evidence volumes. Only its own containers/volumes are removed.
Fixture preparation requires `APP_ENV=test`, `BROWSER_TEST_FIXTURES=true` and
the exact database name `cocoatrace_browser_test`. The scripts reject other
targets before resetting the test schema. The fixture administrator is not an
application or production administrator.

Browser tests accept only local HTTP origins and assert that the API reports
the `test` environment before any journey. The runner supplies the explicit
run flag. Avoid running the raw `test:browser` command against an existing app.
Run only one copy of this suite at a time: it intentionally owns a fixed
Compose project and a fresh database on every run.

Default ports: web 13000, Mailpit 18025, PostgreSQL 15435. Your normal app at
3000 and local inbox at 8025 can remain running. If a port is occupied:

```powershell
$env:COCOATRACE_BROWSER_WEB_PORT = "13001"
$env:COCOATRACE_BROWSER_MAIL_PORT = "18026"
$env:COCOATRACE_BROWSER_DB_PORT = "15436"
npm run test:browser:docker
```

The database starts from the frozen snapshot through migration 010, then applies
all forward migrations, matching the API integration baseline. This validates
current application behavior, not the normal empty-database production
bootstrap. That distinct release blocker is tracked as ENV-019.

## Results and failures

Expected: six `PASSED` journeys and `Browser suite: passed`. Results are in
`browser-test-results/safe/summary.json`; failures also capture a screenshot
with form fields and credential-link elements masked. The custom reporter
redacts URLs and long token-like strings. Fixtures use synthetic addresses.
All browser output directories are excluded from Git and Docker build context.

CI runs the same command in the `browser-identity` job and uploads only the
sanitized `safe` directory on failure. Raw traces are off by default and always
off in CI. Developers can opt into private local traces:

```powershell
$env:COCOATRACE_BROWSER_PRIVATE_TRACES = "true"
npm run test:browser:docker
```

Private traces contain cookies, passwords and token-bearing email links. Keep
them local; never attach them publicly or add them to CI artifacts. For a safe
diagnostic, share the sanitized summary and inspect the masked screenshot.

The web readiness probe uses explicit IPv4 (`127.0.0.1`) and the proxied
`/api/health/ready` endpoint, checking that Nginx can reach the API as well as
listen for HTTP requests. `localhost` can choose IPv6 in Alpine while this
Nginx server listens on IPv4.

Startup failures occur before browser assertions. The runner prints web logs
and probe diagnostics before cleanup when startup fails. Read the Docker error output
first: image download failure, an occupied port or Docker Desktop not running
requires a local environment correction. Cleanup runs even after startup/test
failure. If interrupted, this command removes only the dedicated test project:

```powershell
docker compose -p cocoatrace-browser-tests -f docker-compose.browser-tests.yml down --volumes --remove-orphans
```

## Required release evidence

Authoring checks: 139 API unit tests, API/web builds, browser typecheck,
migration checksum verification and six real Chromium journeys passed. Browser
journeys used temporary WASM PostgreSQL and SMTP capture because Docker is not
available in the authoring environment. Native PostgreSQL 16, actual Mailpit
and production-container execution must pass locally and in CI before merge.

This suite does not prove real-provider inbox delivery, trading integrity,
evidence uploads, recall, accessibility or production configuration. Keep the
existing API/PostgreSQL suite and short targeted smoke checks. Subsequent
sprints must add automated journeys for the behavior they change rather than
repeating the full identity checklist manually.
