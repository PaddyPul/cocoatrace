# Registered cookie-write origin boundary

SEC-007 regression evidence: `api/src/testing/cookieWriteOrigins.test.ts` uses the real Express application and every POST, PUT, PATCH and DELETE in `route-authorization.json`. A separate assertion compares that write inventory with the actual runtime router stack, including nested routers and factories; a newly registered write cannot silently escape this matrix.

| Scenario, for every write entry point                       | Expected result            |
| ----------------------------------------------------------- | -------------------------- |
| Session cookie with no Origin                               | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie with foreign Origin                          | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie with literal `null` Origin                   | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie plus malformed Bearer header, no Origin      | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie plus Basic header, no Origin                 | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie plus malformed Bearer header, foreign Origin | 403 `ORIGIN_NOT_PERMITTED` |
| Session cookie plus canonical Bearer header, foreign Origin | 403 `ORIGIN_NOT_PERMITTED` |
| Foreign Origin matching forged Host and forwarding headers  | 403 `ORIGIN_NOT_PERMITTED` |

The matrix includes public identity routes and capability upload writes, not only session-authenticated registrations. Dummy credentials deliberately never authenticate. Pool query/connect probes assert that none of these requests reaches the database, rate-store or resource processing. No real credential or business payload is needed.

Two real-app logout smoke checks distinguish origin approval from authentication: configured-origin cookie writes with invalid credentials reach a 401; a canonical Bearer credential without Origin also reaches a 401 rather than an origin rejection. Supplying a Bearer header therefore retains the existing machine-client semantics; this matrix does not incorrectly require Origin for all machine clients.

Existing `api/src/middleware/security.test.ts` covers additional origin spellings and credential extraction. `api/test/integration/authBoundary.integration.test.ts` and `e2e/authBoundary.spec.ts` retain actual cookie-session behavior and normal sign-out acceptance. Run native/browser release gates to confirm those flows on the candidate commit; this unit matrix alone does not claim a successful real session or hosted deployment.

Configured `WEB_URL` remains the source of trusted origin identity. Host and forwarding headers cannot redefine it. Hosted TLS, ingress proxy behavior, cookie deployment settings and environment verification remain separate SEC-008 / ENV-006 work. This matrix proves the global entry boundary, not every resource authorization combination or downstream handler's complete behavior.

Run the focused matrix with `npm run test --workspace=api -- src/testing/cookieWriteOrigins.test.ts`. The ordinary API unit-test release gate also discovers it automatically.
