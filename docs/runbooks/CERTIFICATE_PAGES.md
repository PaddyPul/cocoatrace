# Bounded certificate register

GET /certificates/page requires certificate.read and accepts limit (1–100, default 50), search (maximum 80 characters, literal case-insensitive), cursor, farmId (UUID) and status (all/active/suspended/revoked/expired). UUID keyset order is deterministic. Filter changes reset navigation. Cursors bind organization, explicit certificate.read.all scope and filters; each page rechecks authorization. Cursors never grant access.

Visibility matches the legacy register: issuing certifier, recorded farmer organization or buyer/seller linked through a farm batch holding and contract. Only explicit certificate.read.all/wildcard expands this boundary; generic analytics does not. Detail authorization, issuer verification, farm eligibility and status mutation policies remain unchanged.

GET /certificates/summary accepts no parameters and returns full visible recorded-state counts: count, active_count, suspended_count, revoked_count, expired_count. Counts do not establish present validity, accreditation or reviewed supply. Supply organic assessment remains authoritative and checks dates, scope, issuer and attestations separately.

Both endpoints use the existing read-only repeatable-read helper with 2-second SQL and 5-second read deadlines. Search and visibility are evaluated before LIMIT. No metadata bytes/documents are returned beyond the existing certificate projection. Legacy GET /certificates (optional farmId) returns at most 1,000 rows; overflow explicitly returns 422 CATALOG_READ_LIMIT, never a partial successful history.

The focused register uses page navigation, server search/status filters, full accessible count and focus refresh. Failed/malformed page responses show a retry rather than an empty register; failed totals show unavailable. Issuance retains the bounded FarmPicker and existing backend use cases. No buyer/supplier certification requirement is introduced.

Native regressions cover 1,005 records, off-page lookup, party isolation/read-all, scoped cursors, strict inputs, count changes, legacy overflow and EXPLAIN page bounds. Browser definitions cover navigation/search/filter reset, retry and malformed responses. Native release acceptance remains pending. Farm/batch embedded certificate collections and exports remain separate performance work. No migration/configuration/dependency/data reset; rollback API/UI together.
