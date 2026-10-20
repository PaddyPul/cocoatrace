# Private runtime metrics

`GET /operations/metrics` uses the existing authenticated current wildcard administrator guard and returns `Cache-Control: no-store`. Query parameters are rejected. Do not publish this response or expose the route through a public metrics proxy.

The response is a bounded snapshot of this API process since startup. Restart resets all counters. It is not durable, deployment-wide monitoring, uptime evidence, or proof of external alert delivery. HTTP counts include completed responses (including this endpoint after it completes), not abandoned sockets. Five fixed status classes and eleven fixed cumulative duration buckets retain no request samples, URLs, IDs, tenants, credentials, SQL text, or provider details. Duration values use milliseconds; overflow is above 15 seconds.

Database query durations cover the exported `query` helper including pool acquisition and execution, on both success and failure. The exported `getClient` helper separately counts acquisition duration/failures. Queries subsequently made on transaction clients and direct pool calls are not included in the query histogram. Pool total, idle and waiting counts are instantaneous observations. Never subtract these overlapping histograms or describe them as all database traffic.

Queue backlog and lease observations remain independently available at `/operations/backlog`; job outcomes remain at `/operations/status`. Do not infer queue health from the absence of HTTP/database errors. External collectors, retention, thresholds, alert routing and hosted acceptance remain separate deployment work.
