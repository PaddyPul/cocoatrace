# Public service observation

`/service-status` is available without login. On entry or explicit Refresh it reads public liveness and readiness once, concurrently, with a shared five-second deadline, credentials omitted and cache disabled. Only fixed process/dependency states are shown; response metadata/provider details never render. A completed observation becomes stale after60 seconds and shows Unknown until refreshed. It does not poll expensive readiness continuously or replay business writes.

A responding API process is distinct from ready database/storage/scanner dependencies. Known not_ready is Not ready; network, malformed or unexpected replies are Unknown. HTTP200 with unrecognized content never becomes healthy. The page states that observations are not an uptime history, incident feed, trade/payment/evidence/email success receipt or safety guarantee. It links platform responsibilities and workspace. Public role notices provide discovery.

This satisfies a basic customer-facing current status mechanism after runtime acceptance. External independent monitoring, historical incident communication, staffing, release metadata and SLOs remain their own operations gates. The API's existing health endpoints are unchanged; no private metrics are exposed through this page. Private `/operations/metrics` stays live-admin-only and no-store.
