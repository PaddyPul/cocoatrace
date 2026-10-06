# Public and resource abuse protection

Owner: Codex implementation; Albert native release/merge acceptance. Backlog SEC-011; related SEC-010/017, OPS-003/010, PER-001/004. Core abuse gate remains partial until native execution/merge evidence.

## Policy

All budgets use the existing PostgreSQL `auth_rate_limits` table, atomic upserts, database-clock 15-minute fixed windows, saturating counters and expiry-index cleanup of at most 100 expired rows per deployment-counter operation. No new migration or secret. API workers must share the database and JWT_SECRET-derived key material, as they already do for authentication. Restarting a worker does not reset counters. Secret rotation changes the hashed namespaces: coordinate rotation rather than using it to clear a rate limit.

| Operation | Peer IP | Deployment | User | Organization |
|---|---:|---:|---:|---:|
| Public profile | 600 | 6,000 | — | — |
| QR SVG generation | 120 | 1,200 | — | — |
| Scan recording | 60 | 3,000 | — | — |
| Invitation preview | 180 | 3,000 | — | — |
| Evidence upload intent | 300 | 5,000 | 60 | 200 |
| Signed evidence content | 120 | 2,000 | — | — |
| Team invitation creation | 120 | 1,000 | 20 | 50 |

Figures are attempts per 15-minute fixed window, not customer-specific rate promises or measured safe capacity. Invalid attempts and retries consume budgets. Deployment budget is checked first; its exhaustion prevents new attacker-selected peer/actor rows. Peer exhaustion stops actor bucket creation. Operation names are hard-coded; raw slugs, paths, query signatures, tokens, filenames and body-supplied identity fields never select buckets. Persisted keys are HMAC hashes; actor scopes use the live authenticated user/organization. Counters for unrelated organizations are independent, although peer/deployment ceilings are intentionally shared.

Login, password reset/change, access request/verification, invitation acceptance/resend/revoke and access controls keep their existing 10-target/100-peer authentication budgets. This wave adds resource budgets rather than weakening those rules. Invitation previews protect token-lookup load; acceptance remains separately limited. Public traffic cannot authorize any private evidence access.

## Enforcement and error contract

- Public profile/QR/scan and invitation-preview routes check before database-heavy handlers.
- Upload intents and invitation creation require live authentication/permission before charging actor quotas; rate checks precede input/controller work. Entity authorization, byte reservations and storage quotas remain additional checks.
- Signed content checks the anonymous deployment/peer budget before `express.raw`, storage work and scanning. Opaque URL signature/expiry/entity checks still run for allowed requests.
- `429 RESOURCE_RATE_LIMITED` includes `Retry-After` seconds and `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (Unix epoch, consistent with the existing auth API). Client must wait/retry deliberately; avoid automatic loops.
- Counter-store outage returns `503 RESOURCE_RATE_LIMIT_UNAVAILABLE`. Protection never falls back to an unshared in-memory store. Handler side effects do not occur after rejection.
- Rejected attempts change only abuse counters and request logs, not evidence, scan, invitation, payment or inventory state. Counters are attempted-request accounting, not an all-or-nothing commercial transaction.

## Ingress and operations

Express continues to distrust `X-Forwarded-For`, Host and forwarded scheme. Peer means the actual socket peer. Behind the current proxy, visitors may share one proxy-peer budget; quotas must not be advertised as individual end-user IP allowances. Do not enable `trust proxy=true` or trust arbitrary forwarding headers to make a test pass. A future hosted ingress needs explicit trusted-hop/client-address validation and regression evidence under SEC-007/011.

A shared deployment ceiling deliberately sheds load and can temporarily deny otherwise legitimate traffic under attack. Do not delete production counters or increase thresholds casually. Diagnose the operation and 429/503 request logs, verify PostgreSQL health and the configured gateway topology, wait for the persisted expiry, and tune only after measured load/scan latency/memory tests. Existing logs are not a new centralized monitoring/alerting deployment. Keep health/live independent of the counter store; gateway network protections for health/readiness and remaining authenticated reads are separate work.

This is application abuse mitigation, not comprehensive DDoS defense. Proxy/network controls, per-request memory/concurrency bounds, scanner queues, trace graph budgets, measured capacity and alerts remain SEC-010/017, PER and OPS work. No claim that scan counts are unique people or fraud-proof analytics. Signed uploads are still bearer capabilities and must not be shared; rate limits do not replace malware validation or entity authorization.

## Verification

Thirteen deterministic unit tests exercise every configured threshold, ignored input rotation, actor isolation, global cardinality bounds, forged forwarded headers, retry response and fail-closed pre-parser behavior. Real PostgreSQL regressions cover independent-worker concurrency, actual route wiring, tenant quota/session rotation, authentication-first handling, content rejection before raw parsing, expiry and hashed storage. The existing full release exercises ordinary uploads, identity emails/invitations and real trade browser journeys. No long manual checklist is required. Author environment has no Docker/PostgreSQL; native release remains required.
