# API JSON error contract

All JSON error responses (HTTP 400–599) emitted through the Express application pass an early normalizer, including direct controller/auth responses and parser/validation/domain exceptions. Success responses, downloads/streams and non-JSON transport failures are outside this envelope. No business authorization, conflict status or retry policy is weakened.

Required fields: `error` (display message), `code` (stable uppercase machine code), `requestId` (the existing X-Request-Id correlation value). Existing domain codes take precedence; uncoded manual errors receive fixed status-family codes. Retry-After and all HTTP status/header semantics remain. Unknown API routes return JSON NOT_FOUND. Unexpected failures and all 5xx errors use a generic public message; no SQL, stack, provider body or submitted secrets are returned, even in test/local environments. Fixed health status/database/dependency indicators remain available.

Safe optional payloads are explicitly projected: sanitized bounded validation paths/messages; fixed trace incompleteness/safety state; fixed departure missing-field identifiers. Arbitrary custom metadata is discarded. Domain codes are not a guarantee that the operation can safely be retried.

The frontend shared transport raises `ApiError extends Error` with status, code, requestId and Retry-After. Existing callers displaying Error.message continue working. Malformed details cannot crash rendering. Offline failure has NETWORK_ERROR/status0 and a connection message. No financial or other write is automatically replayed after network failure; only the already-existing explicit MFA ceremony retry remains. Login 401 stays a form error; expired workspace sessions and required passkeys preserve the existing security redirects.

Checks: mixed real-Express unit failures, native actual-app auth/parser/unknown-route regression, existing route credential/permission inventory, shared-client malformed/offline/metadata regressions. Native and full release execution occur in the founder environment. This contract supplies ARC-023; whole-resource authorization, OpenAPI generation and universal UX adoption remain separate work.
