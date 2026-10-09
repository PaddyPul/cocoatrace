# Complete, bounded audit exports

`GET /audit/export` produces a complete JSON array of matching audit events or an explicit error. It never supplies the first page under the label of a complete report.

## Authorization and filters

The existing `audit.export` route permission is required. By default, every query restricts events to `actor_organization_id` equal to the signed-in organization. Only explicit `audit.export.all` or `*` grants network-wide export; `audit.read.all` and analytics permissions do not grant it. Privileged account assurance and current session authorization remain unchanged.

Optional query parameters are `entityType` and `entityId`. Supply both together: entity type must be a single value of up to 80 characters matching a letter followed by letters, digits, underscores, dots or hyphens; entity ID must be a UUID. Filtering uses exact equality. Partial, repeated, unsupported and malformed parameters return HTTP 400. The endpoint does not accept page, cursor, limit or offset parameters.

Example: `/audit/export?entityType=sales_contract&entityId=<contract-uuid>`.

## Complete report limits

- At most 1,000 matching records.
- At most 4 MiB of serialized JSON payload.
- Existing catalog read isolation and deadlines: a repeatable-read, read-only transaction; 2-second statement timeout and 5-second total read budget.

The read first selects at most 1,001 IDs with tenant and entity predicates. Record overflow fails before metadata hydration. For at most 1,000 IDs, PostgreSQL calculates serialized row bytes before Node retrieves full records. The final payload is checked again in UTF-8 bytes. The PostgreSQL estimate can conservatively reject a report close to the size boundary. No large report is silently truncated.

HTTP 422 `AUDIT_EXPORT_LIMIT` means narrow the entity filter or arrange an operator-managed export. No attachment header or partial report is sent. Timeouts use the existing HTTP 503 `CATALOG_READ_TIMEOUT`; unverifiable payload size or snapshot shape uses HTTP 503 `AUDIT_EXPORT_UNAVAILABLE`. Do not raise production deadlines or disable the guard to make a test pass.

Successful responses keep the existing JSON-array shape and attachment filename, with stable `occurred_at DESC, id DESC` ordering and `Cache-Control: no-store`. Empty authorized scopes produce `[]`. The snapshot is taken before the new export audit event, so the event recording this download is not part of that same download.

## Durable attribution and sensitive data

A successful export now awaits a direct audit insert before sending any bytes. If attribution cannot be persisted, the response fails instead of claiming a successful download. The export event has a valid generated UUID entity ID, actor user and organization IDs, a required state hash, and metadata containing only exact filter values, record count, byte size and organization/network scope. Previously, the non-UUID `audit-log` entity ID caused the best-effort export audit insert to fail silently.

Exported event fields and authorized metadata are unchanged for compatibility. Audit metadata can contain personal or commercial information; possession of export permission is not a promise that every event is suitable for public sharing. This endpoint adds no raw export content to logs or to the new download audit metadata, and does not broaden tenant access. A separate audit-field/redaction review remains appropriate before public or investor report distribution.

## Verification and rollout

No migration, new dependency, configuration or permission change is required. There is no frontend change; existing export URLs continue to work for reports within the limits. `/audit/events` is unchanged and still needs its separate bounded paging work. Provenance pack exports also remain a separate collection-boundary task.

Local validation for this slice: 14 targeted unit tests passed, ESLint passed, and the new native integration test compiled with strict TypeScript. The native suite adds five cases covering record overflow without success audit, exact complete output and durable audit attribution, unrelated-tenant isolation and explicit network export, byte overflow, and malformed/repeated filters. Network export fixtures use real signed passkey enrollment rather than disabling assurance.

Docker/PostgreSQL execution remains pending the founder's exact-candidate `npm run verify:release` run. A passing local compile is not evidence of a native database run. Push or merge only after the full release report passes for the current commit and required CI checks pass.


## Audit register follow-up candidate

The audit/provenance boundaries wave now introduces dedicated paged browsing and full counts for `/audit/events`; its register runbook supersedes the remaining-work note above after release acceptance. The export contract itself is unchanged: the workspace may pass an applied paired entity type/UUID to narrow the complete export. Search/action filters do not silently filter a download.
