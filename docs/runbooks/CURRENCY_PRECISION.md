# Currency precision snapshots

Supported new-trade currencies: EUR, USD, GHS, GBP (two decimals), JPY (zero decimals). No FX, actual funds movement, new tax invoice or three-decimal currency is introduced. This remains a proposed pilot engineering policy pending commercial approval/provider coverage.

Migration 030 adds currency_minor_units to contracts, payment requests, installments and fee invoices. Every existing row defaults to 2, including historical JPY. No recorded amount, currency, status or ownership is rewritten. Existing fractional JPY retains its original two-decimal meaning. New JPY acceptance explicitly writes 0 to all four snapshots. Down refuses to erase financial precision history; use forward correction.

New goods totals round quantity (3 decimals) × unit price (4 decimals) once, half up to the snapshotted precision. A rounded payable value must be positive and fit NUMERIC(14,2). JPY values remain stored as numeric .00 for schema compatibility, but are mathematically whole yen. Deposits round from the rounded total; the balance is the exact remainder. JPY deposit plans with a zero deposit or balance are rejected; select full payment or increase the trade value. New JPY starts with a draft pay-before-dispatch plan, while the supplier still proposes and buyer confirms their final plan. Existing two-decimal defaults remain deposit/balance.

Fees retain the separate seller completion basis: round raw quantity × price × configured rate/10000 to the contract snapshot precision. Policy label seller-completion-v2 identifies new fee estimates. Existing policies/rates/amounts remain unchanged. Example: 4 kg × JPY 12.625 = JPY 51 payable; 1% fee rounds from JPY 0.505 to JPY 1. A 20% deposit splits JPY 51 into JPY 10 and JPY 41.

Database checks reject fractional money in zero-precision requests, installments and fee invoices. Operational services reject contract/request or installment/request precision drift. Dispatch and settlement enforce snapshot alignment; physical arrival records remain available for containment. Finance receipt validation rejects fractional yen before confirmation. Zero fees require no collection. Reconciliation uses invoice snapshots and separates totals by currency, precision and status so legacy/new JPY history is distinguishable.

Payments, fee statements, accepted deals, offers and dashboard amounts display their snapshots. Unit prices retain four decimals, since per-kg quotes may be fractional even for JPY. Supply selectors include JPY. Pre-submission previews remain estimates; database amounts determine payable schedules. Exported fee JSON includes currency_minor_units.

Validation: local unit/quality/type/build checks plus supplemental PGlite serial SQL checks. Native PostgreSQL, browser journeys, runtime images and restore tests remain required via npm run verify:release. PostgreSQL cases cover new JPY snapshots/all plans, fractional raw mutations, zero-split rollback, precision mismatch and legacy JPY decimals. The real fee browser journey now runs for GHS and JPY, including fractional-yen receipt rejection.

CUR-003 remains IN PROGRESS until native release/CI verification passes. Three-decimal currencies, refunds, mixed-precision display preferences and FX remain additional scope; do not enable currencies by changing only the dropdown.
