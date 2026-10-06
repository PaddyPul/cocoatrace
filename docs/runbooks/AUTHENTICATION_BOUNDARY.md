# Cookie/origin and shared authentication protection

Wave: SAF-001, SEC-007, IDN-013; related SEC-011. Local verification and native pending evidence are recorded in RELEASE_EVIDENCE.md. This does not complete administrator MFA/suspension or every public endpoint abuse policy.

## Credential and browser policy

Authorization, when present, is authoritative. Only one syntactically valid Bearer credential is accepted; malformed headers or invalid bearer tokens never fall back to a cookie. Without Authorization, an exact `ct_session` cookie supplies the session. This keeps the browser boundary and authentication behavior consistent.

All unsafe requests carrying Origin must match the configured WEB_URL origin exactly. Foreign origins, literal null, paths, trailing-slash origins and lookalike domains are rejected with 403 / ORIGIN_NOT_PERMITTED. Cookie-authenticated writes without Origin are rejected. Explicit bearer API clients can write without Origin; cookies are then ignored. GET/HEAD/OPTIONS remain safe-method paths and must not implement business mutations.

Host, X-Forwarded-Host and X-Forwarded-Proto never select the permitted origin. Express trust proxy remains explicitly false: user-supplied X-Forwarded-For cannot rotate IP buckets. Behind a reverse proxy, the IP bucket intentionally measures the immediate peer (potentially shared by users), while account budgets remain independent. A future client-IP policy requires explicitly trusted ingress/CIDR configuration and spoof/direct-access regressions; do not set trust proxy=true or a blind hop count to work around a 429.

Origin verification follows [OWASP's CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Cookie clients that strip Origin must use an explicitly reviewed defense/compatibility path, not a missing-origin bypass. The previous malformed-header server bypass is covered by unit and real-session API regressions; this does not claim a demonstrated end-to-end browser exploit through CORS.

## Shared budgets

Migration 031 adds auth_rate_limits with opaque keyed bucket hashes, attempt count and expiration only. No raw IP/email/token/URL is stored. Fixed 15-minute budgets: 100 requests per route and immediate peer IP, and 10 per actual account/token/user target per route independent of IP. Route templates prevent secret invitation tokens becoming operation names. Route-specific identity fields prevent ignored JSON email/token fields changing the budget.

Each bucket uses an atomic PostgreSQL upsert with database statement time. Counts saturate at limit+1; a new API instance uses the same persisted counters. IP exhaustion stops before allocating additional target buckets. A bounded indexed cleanup removes up to 100 expired rows per IP check; if no sensitive traffic occurs, expired hashes remain until the next check. These are ephemeral operational records, not immutable security audit events; include their retention in the operational data policy.

429 responses include AUTH_RATE_LIMITED and Retry-After/RateLimit headers. Missing table/DB/store failure returns 503 / AUTH_RATE_LIMIT_UNAVAILABLE and never disables protection. Apply the manifest-verified migration before starting the new API. Database connectivity remains a dependency of these sensitive endpoints. Cookie origin failures occur before consuming authentication budgets.

Covered routes: login; forgotten/reset/changed password; request access/verification; invitation acceptance; invitation resend/revoke. Public QR/scan and upload-intent route budgets, distributed edge DDoS controls, MFA and operational abuse alerts remain separate SEC-011/IDN/OPS work. Limits are not configurable via a test-only production bypass. Migration 031 is additive; do not drop the table as an operational reset or change deployed historical migrations.

## Automated verification

Unit tests exercise credential precedence, unsafe methods, absent/null/foreign/lookalike origins, forwarded headers, separate hashed account/IP keys, ignored-field injection, 429 retry headers and fail-closed store errors.

PostgreSQL regressions exercise actual sessions and unchanged session state after denied logout; allowed browser/bearer logout; concurrent store instances accepting exactly ten requests; saturated persistence; expired reset and bounded cleanup; account/IP rotation and target-allocation bounds; and API retry responses. The integration harness resets only disposable rate counters between test files under its guarded test database, not production thresholds or application data.

The browser suite creates a real approved buyer, attempts cookie writes without/with foreign Origin and malformed Authorization, verifies the session is retained, and signs out normally. Existing direct API browser fixtures explicitly set the disposable application's Origin; an independent negative-test client intentionally does not. No new long manual persona checklist is needed.

Commands: npm run verify:release (full native gate), with API unit/type/build and migration integrity covered in the release runner. Preserve release-test-results/summary.json and safe browser failure reports if a gate fails. No native success is claimed by local unit checks.

## Deployment and rollback

Use the existing normal migration release command, then deploy the API and exact WEB_URL matching the browser origin. Keep DB ports private. Check normal sign-in/sign-out and cookie-origin denials after deployment. Alert on AUTH_RATE_LIMIT_UNAVAILABLE and abnormal 429 rates; centralized monitoring remains an open OPS item.

Application rollback leaves the additive table in place. It also restores weaker old protections, so any rollback must be reviewed, restricted in duration and isolated from customer access if the risk cannot be controlled. Prefer a forward repair. Do not delete customer data/volumes or blanket-reset counters to resolve deployment problems. Record candidate SHA and results before marking SAF-001/IDN-013 complete.
