# Investor rehearsal correction — 2026-10-23

This combined candidate includes the unapplied insurance/transport presentation correction and the founder's seven yam-trade observations. Do not apply the older trade-document-progress bundle separately.

| Observation | Candidate behavior | Founder acceptance |
| --- | --- | --- |
| Batch starts as cocoa | Reads distinct normalized crops from all authorized farm plots; one crop fills automatically, multiple crops require a choice, missing/unavailable crops require explicit entry and review. Changing farms clears the previous crop. | Pending |
| COCOBOD ID | Farm creation, detail and list say Farming cooperative ID. Existing stored identifier values and API field names are retained. | Pending |
| Plot starts as cocoa | Crop entry starts blank on both plot entry paths. At least one named crop is required. | Pending |
| Partial order unclear | Matched lots show requested kg/metric tonnes, available kg, coverage and shortfall. Request context follows the details link; sending a smaller offer requires acknowledgement and is blocked when explicit request context cannot be read. | Pending |
| Admin misses fee review | Separate finance panel on Home reads pending submitted references across the authorized ledger, polls every 15 seconds and refreshes on focus. It links to receipt review; it never marks a reference as verified. | Pending |
| Fee register lacks dates/search | Server-side search, status, pending-review and inclusive UTC created-date filters; newest-first cursor pages; creation, invoicing, latest submission and verified receipt timestamps. Missing timestamps are explicit. | Pending |
| Fees obscure delivery acceptance | Delivery inspection follows the best next action immediately; that action links to inspection. Fee details collapse after delivery unless the next action concerns the fee. | Pending |

Additional correction: yam, cassava, maize/corn, rice and plantain are recognized by the deterministic sourcing parser with word boundaries. Unrecognized materials remain blank for manual review. Publication errors list the exact missing reviewed fields. No claim of general AI understanding is introduced.

## Existing trade recovery

No reset, migration or backfill is needed. Correctly typed insurance evidence still must be validated and scan-clean. Uploading Other never satisfies the insurance requirement. After adding the complete set, the seller separately chooses Present documents for payment.

Previously recorded crop/identifier values are not retagged. Inspect historical batches created with the old default before treating their crop descriptions as accurate. The UI uses Crop not recorded for missing crop data instead of inventing cocoa.

## API changes

- `POST /farms/:id/plots`: `crops` is now required, with 1–100 trimmed nonempty strings, each at most 80 characters. No implicit cocoa.
- `POST /batches`: `crop` is now required, trimmed, 1–80 characters. No implicit cocoa. This is a request validation change; update older external callers.
- `GET /farms/:id/plots/summary`: retains `count`, adds normalized distinct `crops` across the authorized farm, capped at 101 values. This is a suggestion for the harvest, not independent verification of the harvested crop. A mixed/missing crop is never arbitrarily selected. The existing farm access guard runs before the crop read.
- `GET /platform-fees` without `view=page` retains its legacy latest-200 array response.
- `GET /platform-fees?view=page` returns `{items,hasMore,nextCursor}`. Parameters: `search` (max 80 characters; organization names, fee/trade IDs or currency), `status`, `review=all|pending`, `from`, `to` (created date in UTC), `limit` (1–100), `cursor`, `sort=newest`. The same existing route permission and payer/platform-finance scope apply. Newest-first ordering uses creation timestamp and ID; cursor scope includes organization, finance visibility and filters. Filters run before LIMIT. Timestamps do not expose bank references.
- Receipt verification mutations keep their independent receipt checks, audit and fresh-passkey enforcement.

## Validation and limits

Release correction after the founder's first full run: the UI must distinguish physical dispatch from eligibility to present documents. The API permits document presentation at handover/loading and later stages. Arrival/dispatch timeline wording must not move that payment trigger later. New browser regressions explicitly cover handover/loading with complete CIF documents; fee and plot-draft journeys now interact with the intended collapsed/required-field UI.

Author checks: 1,651 API unit tests; 23 production-web Chromium checks with mocked APIs; API build; web production build; browser typecheck. Further quality/backlog/budget checks are recorded in the PR body. Added native PostgreSQL regressions cover mixed crops after the first plot page and pending-fee date/search/paging/tenant isolation; Docker/native execution is a required Windows/CI release gate, not claimed as author-run evidence.

Founder reported the earlier trade completed on PR #146 main before these changes. This accepts that run only. INV-003 stays IN PROGRESS pending the corrected fresh rehearsal, safety/fallback checks and remaining investor acceptance. No whole-backlog percentage increase is claimed.
