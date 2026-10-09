# Authenticated recall register pages

PER-001 / ARC-024 remain IN PROGRESS. This slice bounds the register, not recall response detail collections, public passport histories or exports.

## Contract and boundaries

GET /recalls/page requires authentication and accepts limit (1–100, default 50), literal search (up to 80 characters), status (all/draft/active/resolved), severity (all/advisory/warning/critical), UUID scope-bound cursor and id order. Filters/search precede the candidate LIMIT. Response is items, hasMore and nextCursor. Each item has batch_count and affected_lot_count instead of batch_ids/affected_lots arrays.

GET /recalls/summary requires authentication and accepts no parameters. Returns count and active_count across all accessible notices, independent of current page/search/filters. Shared recallScope and workspace recallTotals avoid differing register/dashboard visibility rules.

Notice visibility remains initiated_by_organization_id, recall_participants membership, or explicit recall.manage.all (including platform wildcard). Recipient access needs no batch investigation permission. Generic analytics/network read grants do not widen recall access. Every read evaluates current membership. A cursor is navigation state, never an authorization grant. Response, acknowledge, recovery and resolution use unchanged independent authorization/transaction policies.

GET /recalls remains compatible within 1,000 notices and 1,000 total linked batch/lot references. It checks counts before fetching legacy arrays and returns 422 CATALOG_READ_LIMIT on overflow. No silently truncated safety scope. Legacy order is UUID, replacing timestamp order. Read-only repeatable snapshots and catalog SQL/read deadlines remain in force. Linked counts are computed only for limited page candidates.

## UI and safety semantics

RecallRegister owns notice search/status/severity, pages, full totals, focus refresh and retry. Failure/malformed envelopes never assert an empty or safe workspace; unavailable totals remain unknown. Opening a response retains original recipient/manager controls; changing page/filter/user closes old response context. Creation refreshes the register. Genealogy calculation/activation remains independent; an unavailable genealogy view does not hide permitted notice responses.

Active, resolved and draft explanations are distinct. Resolved status does not release retained holds, returned or destroyed stock. Active-count zero is a notice total, not safety clearance.

## Verification and remaining work

Ten new unit cases, four PostgreSQL definitions (1,005 notices, 1,005 linked batches, filtered/full counts, issuer/recipient isolation, revoked membership, explicit network scope and overflow) and seven browser definitions cover this slice. Existing response and trace mock contracts are updated to page/summary envelopes; real recall recovery/safety journeys remain in the release. Fixture teardown deletes child memberships/links before notices and always closes the pool.

Native Docker execution is unavailable in the author environment. Strict test-source compilation does not substitute for the founder's exact-candidate verify:release. No migration/backfill/configuration/data reset. Roll back API/UI together; no data compensation. Remaining: recall response collections, public product histories, exports and representative hosted performance/index acceptance.

## Same-page refresh correction

The shared page hook has an opt-in retainDuringRefresh option used only by RecallRegister. Existing rows stay mounted while the same user/filter/page read is pending, so focus refreshes or response mutations cannot detach the recovery form or erase its unsaved quantities, notes or selected file. aria-busy marks that pending read. Successful reads replace row data under stable notice IDs; removed notices disappear. Failed reads clear prior rows and actions, and page/filter/user changes clear context immediately. Other catalog consumers retain their default loading behavior. Mutation authorization remains server-enforced. Browser regressions cover delayed focus refresh with dirty recovery values and access-revoked refresh clearing stale actions.

The affected-holding select has the explicit accessible name `Your affected holding`. The delayed-refresh regression selects that exact combobox name; option text inside the enclosing label must not change its accessible identity.

## Legacy inventory/transfer overflow correction

Legacy inventory and transfer reads first fetch at most 1,001 scoped IDs with the same join eligibility as their detail reads. Overflow rejects before recall projection; small results hydrate only those IDs within the same repeatable-read transaction and repeat tenant scope. The two-second statement and five-second transaction budgets are unchanged. Existing PostgreSQL overflow tests remain strict about 422/CATALOG_READ_LIMIT; unit regressions verify no recall projection runs for overflow and recall state survives small-list hydration. Native exact-candidate acceptance remains pending.

Recovery-note and resolution-reason textareas also have explicit accessible names. Editable textarea content must not affect the exact name used by assistive tools or the delayed-refresh regression. Dirty recovery-value assertions remain required before and after refresh.
