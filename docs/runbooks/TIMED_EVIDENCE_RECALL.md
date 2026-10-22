# Time-bound evidence and recall workflows

Candidate: UPL-010, UPL-012, RCL-004. Base: accepted main PR #141. Three engineering outcomes require full release and founder acceptance; hosted gates remain separate.

## Private expiring downloads

`POST /evidence/:id/download-links` requires the current authenticated session, `evidence.read`, and the existing entity/party, scan/review and protected-document release policy. It returns a relative `downloadUrl`, `expiresAt` and `lifetimeSeconds:60`. Issuance performs no provider read or business mutation. The signature uses the existing upload signing secret with a separate `evidence-download:v1` HMAC domain and binds evidence, user, organization, session and expiry. No new secret is needed.

The web requests a fresh link for each explicit download. `GET` of the returned URL still requires authentication and current permission; this is not an anonymous sharing capability. Redemption rejects incomplete/tampered/foreign-session links (403), expired links (410), ended sessions (401), and existing resource/scan/payment denials. After provider I/O, current session/permissions and the evidence policy are checked again, then expiry is checked before attachment headers/bytes are released. A user can request another fresh link; there is no automatic retry of a failed response. Links may be reused by the same authorized session within their window; one-time consumption is not claimed.

The old query-free authenticated download action remains available for existing API clients. Removing link parameters invokes that separate live-authorized action; it does not bypass any session, tenant, scan or payment condition. When any link parameter is supplied, the complete signed link must verify. Retained historical evidence may still be downloaded under existing access rules; a recorded document expiry reminder does not erase the original or manufacture a trust decision.

Request logging strips all query values. Links are not stored in browser preferences, database audit metadata, or ordinary navigation history; downloads use an in-memory blob. Existing access events record release readiness, not client receipt. A later live-access/expiry denial can occur after that readiness event and still prevents bytes from leaving. Clock accuracy and deployment-key storage/rotation remain operational requirements.

## Renewal reminders

The contribution form accepts an optional document expiry calendar date. The UI records the end of that UTC day; API clients can provide an explicit offset-bearing ISO timestamp as `documentExpiresAt`. The upload intent and completed evidence retain this metadata. It is uploader-recorded, not an independent review or extension of validity. Unknown historical dates remain null; the migration performs no invented-date backfill.

The existing authenticated Notifications feed derives renewal notices within30 days and after expiry. Certificate `valid_to` is inclusive through the end of its UTC calendar day. Certificate issuer/farmer organizations with certificate read permission see their own renewal notices; ordinary callers gain no network scope. Documents require evidence read permission and uploader-organization ownership, clean/validated bytes, no rejected review and no superseding version. Revoked/suspended certificates and superseded documents do not remain renewal tasks.

Opening a reminder filters the actual certificate/evidence register to that record. Users review the original and use the existing issuance/upload/replacement workflow; reminders never automatically issue certificates, approve evidence or change validity. A changed expiry or due/expired phase gets a new unread identity. Marking a reminder read does not renew anything. Notices are current tasks, not a retained historical inbox. Reads recompute current state; use Refresh notifications to observe elapsed deadlines while keeping the page open. Email/push delivery and operational inbox acceptance remain separate work.

## Recall acknowledgement deadlines

New activations accept `acknowledgementDeadlineHours`: default24, integer1–168. The manager sees it in the activation form and confirmation. The server snapshots `NOW()+hours` in the same transaction as activation, safety holds, participants, delivery intent and business audit. This is an operational acknowledgement target selected for the recall, not a statutory deadline or automatic resolution rule.

Unacknowledged affected organizations get due/overdue tasks. Authorized recall managers get contact/escalation tasks for their unacknowledged participants; only explicit existing network authority can see unrelated recalls. The server derives overdue state from database time on every feed read. Reading a task is not acknowledgement; contacted/unreachable/escalated records do not silently acknowledge. The existing acknowledgement action clears the current task, and resolution clears active tasks while preserving existing stock holds. Deadline reminders never mutate inventory or automatically escalate to an external service.

Response pages show the stored deadline and overdue guidance. Historical recalls have a null deadline and explicitly say it was not recorded; no retroactive deadline is invented. Their existing acknowledgement/contact/recovery workflow remains available.

## Bounds, deployment and rollback

All producers use a1001-row sentinel and a complete-feed1000 limit with the existing five-second read timeout. Overflow or query failure is an explicit unavailable-feed error; safety reminders are not silently truncated or replaced by an empty state. Recipients/read receipts are reauthorized in the existing repeatable-read notification transaction. No reminder worker, email provider or paid service is introduced.

Forward migration053 adds three nullable timestamp columns and tenant/expiry/pending-participant indexes. No frozen/applied migration is edited. Index creation takes normal migration/index locks on existing tables; stage and schedule for the actual data volume before hosted deployment. Deploy the migration before the new API. Old code can coexist with nullable columns and the legacy authenticated download action; rolling code back hides the new reminders but does not erase recorded dates. Down migration refuses populated timed history; prefer forward repair. Do not reset volumes or remove migration history.

Native regressions cover link binding/expiry/tampering, current permission and session revocation, changed scan state during provider I/O, upload expiry persistence, private/unknown/future/superseded renewal cases, certificate expiry/revocation/unread identity, recall deadline snapshot/privacy/acknowledgement/hold preservation and invalid deadline rejection. Browser scenarios cover expiry entry, deadline confirmation/draft retention and all three actionable reminder links. The full release remains mandatory on the captured candidate before push. Source/unit checks and mocked browser runs do not substitute for native PostgreSQL and Docker acceptance.
