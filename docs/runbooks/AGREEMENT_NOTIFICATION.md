# Agreement acknowledgement and current notices

## Agreement record

Contract detail and Deal Room expose an on-demand review. Only current contract parties can read it, including users with wildcard permission. A buyer needs offer.create and a seller offer.respond, alongside contract.read, to acknowledge. The transaction rechecks live account, organization, session, grants and mutation assurance.

The immutable schema-v1 snapshot includes contract/party/offer/listing/holding IDs, quantity, price, currency, Incoterm and listing origin/destination. It excludes mutable payment-protection terms, which retain their separate proposal/confirmation workflow. This is an acknowledgement of the base commercial record, not a signed legal contract or guarantee of legal effect. No past acceptance is inferred. No dispatch, settlement or custody gate changes.

First review materializes the current immutable version. A changed canonical snapshot creates a new version; old receipts do not accept it. POST must include the reviewed hash and confirmed=true. Stale review fails409. Same-party retries insert one receipt/audit, atomically. Stored attribution is private; counterpart display exposes party timestamp only. Cancelled trades cannot receive new acknowledgements. Never amend/delete version or receipt history; correct the source through authorized workflows then review the new version.

## Current trade notifications

Notifications reuse current authoritative trade-action policy with current actor permissions. They include actionable, waiting and completed current status notices, not a complete historical inbox, safety feed or email delivery log. A changed action fingerprint is unread; disappeared actions leave the feed. Read receipts are private to user+organization. Reading never changes trade state. Use the underlying deal to determine full current status.

Source SQL retrieves at most1001 offer/contract records, before contract enrichment, and explicitly refuses oversized scopes rather than claiming completeness. Current feed cap1000; page cap100, default25. Query statement timeout5seconds. Read receipts query only current fingerprints. Cursor binds actor, organization, filter, page size and current revision; changed states require refresh. This bounded first implementation needs replacement with a durable event feed before larger organizational scopes. It is not a throughput claim.

Links use a fixed same-origin workflow allowlist. Inputs cannot store arbitrary URLs. List and totals come from the same snapshot. Errors show unavailable status, never invented zero counts. Sidebar/header entry does not poll every workspace page. No outbound worker, provider notification or third-party service is introduced.

## Deployment and verification

Forward migrations044/045 are required. Preserve frozen migrations and database volumes; normal Node startup migrates. No npm/npx exists in the hardened API image. Roll back application code only after compatibility review; preserve acknowledgement history. Native tests cover parties, isolation, stale hashes/cursors, idempotency, immutable receipts and atomic audit failure. Browser definitions mount the actual pages. Author-only checks do not replace full Docker/native/browser/restore release and required CI.
