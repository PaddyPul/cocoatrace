# Bounded certificate register

GET /certificates/page requires certificate.read and accepts limit (1–100, default 50), search (maximum 80 characters, literal case-insensitive), cursor, farmId (UUID) and status (all/active/suspended/revoked/expired). UUID keyset order is deterministic. Filter changes reset navigation. Cursors bind organization, explicit certificate.read.all scope and filters; each page rechecks authorization. Cursors never grant access.

Visibility matches the legacy register: issuing certifier, recorded farmer organization or buyer/seller linked through a farm batch holding and contract. Only explicit certificate.read.all/wildcard expands this boundary; generic analytics does not. Detail authorization, issuer verification, farm eligibility and status mutation policies remain unchanged.

GET /certificates/summary accepts optional farmId (UUID) and returns full visible recorded-state counts: count, active_count, suspended_count, revoked_count, expired_count. Counts do not establish present validity, accreditation or reviewed supply. Supply organic assessment remains authoritative and checks dates, scope, issuer and attestations separately.

Both endpoints use the existing read-only repeatable-read helper with 2-second SQL and 5-second read deadlines. Search and visibility are evaluated before LIMIT. No metadata bytes/documents are returned beyond the existing certificate projection. Legacy GET /certificates (optional farmId) returns at most 1,000 rows; overflow explicitly returns 422 CATALOG_READ_LIMIT, never a partial successful history.

The focused register uses page navigation, server search/status filters, full accessible count and focus refresh. Failed/malformed page responses show a retry rather than an empty register; failed totals show unavailable. Issuance retains the bounded FarmPicker and existing backend use cases. No buyer/supplier certification requirement is introduced.

Native regressions cover 1,005 records, off-page lookup, party isolation/read-all, scoped cursors, strict inputs, count changes, legacy overflow and EXPLAIN page bounds. Browser definitions cover navigation/search/filter reset, retry and malformed responses. Native release acceptance remains pending. Farm/batch embedded certificate collections and exports remain separate performance work. No migration/configuration/dependency/data reset; rollback API/UI together.


## Embedded detail consumers

The web farm detail requests GET /farms/:id?certificateMode=paged. After the existing farm.read and farm relationship checks, the response includes certificates:null and certificate_collection:paged (or unavailable without certificate.read). This keeps certificate history out of the farm payload. Certificate panels independently call the scoped page and farm-filtered summary endpoints; farm access alone does not grant certificate access. Cooperative farm access does not disclose certificates beyond the register relationship predicate.

Legacy farm details still support a certificate array only with certificate.read and the register's certificate relationships, capped at 1,000 with explicit overflow refusal. Read-all uses certificate.read.all, not farm.read.all. This intentionally tightens legacy certificate disclosure; consumers must handle unavailable rather than treating it as zero. Plots are unchanged and remain a separate bounded-read follow-up.

Batch attestation now uses a searchable, paged recorded-active certificate selector with retained selection, visible errors and retry. Opening/cancelling the selector clears previous hidden selection. The existing transaction checks issuer, farm, crop, dates and certificate status at attestation time; stale or revoked choices do not grant attestation. No new certificate lifecycle or approval policy is introduced.

Founder accepted the standalone register release/merge/pull on 2026-10-08 17:21 UTC. The detail consumer slice remains pending native release acceptance. Tests cover farm certificate overflow, paged omission, scoped counts, farm-only/cooperative isolation and browser selector/failure states. Batch evidence arrays, plot arrays, profile/recall collections and exports remain open.
