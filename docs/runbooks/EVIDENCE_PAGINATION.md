# Evidence metadata reads

| Endpoint | Scope | Bounds |
| --- | --- | --- |
| `GET /evidence/page` | Uploader organization; explicit `evidence.read.all` can read the network | Default 50, maximum 100; UUID keyset order |
| `GET /evidence/page?entityType=…&entityId=…` | Existing evidence entity relationship policy; rechecked per request in the same snapshot | Same page limit |
| `GET /evidence` with or without entity pair | Same existing scopes | Maximum 1,000; 422 `CATALOG_READ_LIMIT` on overflow |

The paged API accepts `limit`, `search`, `cursor`, `sort=id`, and paired `entityType` / `entityId`. It rejects unknown page parameters, unsupported entity types, malformed UUIDs, overlong search and invalid page sizes. Search is literal, maximum 80 characters, applied before LIMIT to ID, filename, evidence type, linked entity type/ID and review state. Percent/underscore are not wildcard controls. Pages report `items`, `hasMore`, `nextCursor`; item counts are page counts, not totals.

Cursors bind organization, live network-read scope, entity pair, normalized search and order. They are positions, not authorization credentials. Every entity-scoped page invokes the unchanged farm/batch/certificate/contract/shipment/product-profile/recall relationship predicates using the bounded snapshot executor. Default policy callers retain pool-query behavior. Current middleware still authenticates and checks live resource permission before the handler. The existing catalog snapshot applies a two-second statement timeout, five-second read budget and linked-row refusal.

Metadata never includes storage paths/keys, upload signatures or uploader identity. Listing metadata does not authorize a document download. Downloads retain separate entity/uploader authorization, validated-and-clean scan checks and controlled transport-document payment release. Review status and scan status are separately shown. A scanned file is not an approved assurance claim.

Legacy list arrays retain created-date ordering, capped explicitly. Oversized responses fail rather than silently omit older evidence. The page API uses stable UUID ordering, not a most-recent-first claim. Read failure and malformed page responses show retry, not a successful empty-workspace message. Scoped URL parameters remain attached during page/search navigation.

Run `npm run verify:release` for exact-candidate acceptance. Unit SQL/policy/cursor checks, native 1,005-document scope/revocation/overflow cases and browser navigation/error fixtures supplement existing payment-protected download and real upload journeys. No migration or data reset is required. Do not seed/delete application volumes to test this change.

Remaining: evidence contribution record selectors; control-tower full aggregates; detail endpoints embedding evidence arrays; other list/export consumers; hosted index/query-plan and concurrent-load acceptance. These are open under PER-001 / ARC-024 / PER-003 / PER-004. This slice does not close universal pagination or hosted performance readiness.
