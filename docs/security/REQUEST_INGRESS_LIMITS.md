# Global request ingress budgets

SEC-010 implementation slice, reviewed 2026-10-15. Limits apply before route handling;
resource authentication, tenant policies, route-specific validation and durable abuse
budgets still apply. A limit rejection does not attest to resource existence.

| Input | Global application limit | Response |
| --- | --- | --- |
| JSON body | 100 KiB, explicit existing Express default | 413 `REQUEST_BODY_TOO_LARGE` |
| Malformed JSON | Invalid JSON is rejected without echoing payload | 400 `REQUEST_JSON_INVALID` |
| Raw query | 8,192 UTF-8 bytes | 414 `REQUEST_QUERY_TOO_LARGE` |
| Query parameters | 64 occurrences, including repeated keys | 400 `REQUEST_QUERY_LIMIT` |
| Decoded query key/value | 128 / 2,048 UTF-8 bytes | 400 `REQUEST_QUERY_LIMIT` |
| Query bracket nesting | At most four opening brackets per decoded key | 400 `REQUEST_QUERY_LIMIT` |

The original Express query parser runs only after the budget check, preserving its
ordinary scalar, repeated-key and nested parsing behavior. Excess parameters are
rejected, never silently truncated. Existing paged cursor limits are stricter and
remain enforced. Route filters can impose lower bounds and reject unknown keys.
These limits also apply to health and public endpoints.

Signed evidence content PUTs bypass JSON parsing even if a client labels its file
as JSON. Existing rate admission, signed capability validation, organization/global
transfer concurrency and raw file parser remain authoritative. Evidence overflow
retains `EVIDENCE_FILE_TOO_LARGE`; generic JSON overflow no longer pretends to be an
evidence-file error. This is an intentional pre-pilot error-contract clarification.

Oversized and malformed body responses contain no submitted password, token, body
fragment or parser diagnostics. API operational logging uses the existing redacted
request serializer. A query failure occurs after Express response initialization
but before route execution; it does not require database access.

The Node HTTP parser or an outer proxy may reject a larger URL/body first, with a
provider-specific response. Nginx's file body ceiling is separate. This is not an
edge DDoS service, per-client proxy attribution or a global bound on all simultaneous
ordinary requests. Evidence concurrency is bounded today; full general admission,
proxy-aware budgets and deployment load evidence remain SEC-010/PER-004 follow-ups.
No timeout is raised merely to make a performance regression pass.

Regression tests exercise the real Express app without database access for query
boundaries, malformed/oversized JSON and evidence parser bypass. The test-only
rate-store bypass is scoped to this suite; production limiters remain installed.
