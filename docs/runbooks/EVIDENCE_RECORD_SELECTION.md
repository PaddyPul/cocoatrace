# Paged evidence record selection

`GET /evidence/record-options` requires authenticated `evidence.upload` and the selected kind's read permission. The four supported kinds are `farm`, `batch`, `contract`, `shipment`. Ordinary `evidence.read` or network evidence read is insufficient to select a source/trade record for upload.

| Parameters | Behavior |
| --- | --- |
| `kind`, optional `limit/search/cursor/sort=id` | Default 50, maximum 100 options per page; literal search before LIMIT; UUID keyset order |
| `kind`, `id` | Exact UUID lookup inside the same permitted list scope; returns zero or one option; cannot combine paging/search parameters |

The response contains `items: [{id,label}]`, `hasMore`, `nextCursor`. It excludes commercial quantities/prices, private file locators and full record objects. Search is at most 80 characters. Percent and underscore are literal. Unknown parameters, invalid kinds, UUIDs and page sizes fail explicitly. Shared catalog snapshot deadlines/row budgets apply. Cursors bind resource kind, organization, normalized search/order and existing source read breadth. Each request rechecks live middleware permissions and row relationships; cursors do not grant access.

Farm/batch list and exact lookup retain existing owner/cooperative/certifier/holding/trade relationships and named source read-all policy. Farm exact lookup intentionally uses its list boundary, not its broader detail relationship. Contract/shipment options are seller/buyer-scoped, matching existing lists; logistics/coordinator assignment and hypothetical read-all permissions do not introduce trade selection access. Future provider-marketplace roles need their own reviewed permission design.

The contribution picker searches and pages without loading all records. A selected option is pinned when it leaves the visible page. Page/search changes retain the selected record, explanation and file. A real selection/kind change clears old explanation/file/success/error context. A direct `entityType/entityId` link resolves through exact permitted lookup, including case-insensitive UUID comparison. Failed reads and missing/unavailable requested records show distinct notices/retry; successful filtered misses do not introduce first-time setup actions. Upload is blocked while current reads are unavailable. Its server-side resource authorization remains authoritative.

The existing contribution route still supports four record kinds. Plot documents use the selected farm plus an explanation naming the plot. Certificate/product-profile/recall direct workflows retain their own upload actions; this change does not generalize those selectors or claim assurance approval.

Run `npm run verify:release`: unit SQL/policy/DTO tests, six new native case definitions using 1,005 records per kind, five browser presentation cases, and existing real source/evidence journeys. Browser presentation fixtures verify payload targeting but do not substitute for real upload/scanner tests already in the release suite. No migration/reseed or deletion of application volumes is required.

Remaining PER-001 / ARC-024 scope: general offer/contract/shipment/payment lists, control-tower full aggregates, detail collections, exports and other large selectors. Hosted index/query-plan and representative concurrent-load acceptance remain separate PER-003 / PER-004 gates.
