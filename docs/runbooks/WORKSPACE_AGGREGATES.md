# Workspace aggregate contract

GET /workspace/overview requires authentication and accepts no query parameters. It runs sequential count/sum queries inside the existing bounded read-only repeatable-read snapshot: 2-second statement timeout, 5-second total read deadline. It returns fixed-shape groups, not full record histories, evidence bytes or network edges. Resource read failures fail the request; no fallback zero, clearance or recommendation is produced by the overview UI.

Each group independently follows its existing resource boundary:

| Group | Read gate | Scope |
|---|---|---|
| batches | batch.read | Shared source-list relationship predicate; batch.read.all only expands this group |
| products | batch.read | Existing private profile list scope; product_profile.read.all only expands this group |
| lots | batch.read | Existing lot page owner/holding/trade/distribution scope; traceability.read.network or recall.manage.all |
| recalls | authentication | Existing recall initiator/participant scope; recall.manage.all |
| evidence | evidence.read | Uploader organization or evidence.read.all |
| farms | farm.read | Existing source farm summary policy |
| listings | listing.read | Existing public eligible-listing summary |
| contracts/shipments/payments | corresponding resource.read | Existing buyer/seller summaries, no logistics or read-all expansion |
| offers | offer.create or offer.respond | Existing buyer/seller offer summary |

Unavailable permissions yield null group values, not zero. Wildcard permissions retain existing explicit wildcard behavior. Generic analytics/network/write permissions do not enable other groups. Counts can have different scopes and are labelled accessible/workspace records, not a single universal network total. SQL SUM of source lot quantity remains a decimal string; it is recorded source volume, not free inventory. No currencies are combined.

Batch reviewed count uses the shared reviewedOrganicSql certificate predicate: current certificate, matching farm/crop/harvest, verified independent certifier, linked attestation/user and nonfuture attestation. Legacy organic flags do not establish reviewed status. Product held count uses activeBatchRecallSql, including retained holds and returned/disposed material after notice resolution. Evidence count is metadata only; it does not claim approved or scan-clean content.

ControlTowerPage consumes only this overview plus the independent readiness advice endpoint. It resets stale metrics during refresh, validates count envelopes, rejects failed/malformed responses and offers retry. It omits unreadable metric cards and pauses recommendations on overview failure or visible material safety holds. The unused old DashboardPage is a compatibility re-export, eliminating its full-array and obsolete carrier-action implementation. Hard-coded corridor, synthetic readiness percentage and healthy-network assertion are removed.

The existing /readiness endpoint retains its own organization/analytics.read.network scope and recommendation policy. Its reviewed count now runs directly in aggregate SQL under the same read deadlines, rather than hydrating every batch, plot and review. A separate recommendation-policy review remains open; the advice is not certification or legal clearance.

No migration/backfill/dependency/configuration change. Roll back the API/UI commit together if needed. Existing resource detail pages, mutations, trade next-action endpoint and /home journey remain unchanged. Large product/certificate/recall metadata lists and exports remain separate performance slices. Native release is required before merge; hosted capacity remains unproven.
