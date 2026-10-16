# PR title

feat: close sourcing demand and renew expiring supply with audited safeguards

# PR body

## Outcome

Buyers explicitly award or close sourcing requests after reviewing allocations. Suppliers review expiry and renew current supply with fresh inventory/recall checks. Expired supply cannot receive or accept new offers, while existing agreements and audit history remain intact.

## Tracking

- Backlog ID(s): TRD-018 and TRD-020 closure targets; accepted IDN-016/017/019 reconciled.
- Issue/ADR: docs/runbooks/SUPPLY_DEMAND_LIFECYCLE.md.
- Target phase/environment: application lifecycle for local/CI pilot acceptance; hosted capacity remains separate.

## Change summary

- Add explicit confirmed buyer sourcing closeout, immutable receipt, same-buyer/commodity noncancelled agreement association and atomic audit; retain read-only terminal brief and reason.
- Add default30-day expiry to new listings, explicit reasoned renewal within90 days, owner register controls and expiry guards in offer creation/acceptance, publication and inventory reservation paths.
- Preserve nullable legacy no-expiry terms honestly, preserve original expiry on partial-acceptance continuation, and reject pending offers on renewal without changing accepted deals.
- Add unit, native and browser regression definitions and reconcile accepted team-access progress.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: owner-scoped nondisclosing404, server validation, existing session/MFA gates and sensitive-action limits retained. Decisions use atomic audit transactions and stable inventory locks. Explicit closeout serializes to one receipt. No raw private file references or outgoing messages. Award association is buyer_manual, not proven originating provenance. Expired stock cannot gain new offers through a direct request or active=true edit.

## Database and deployment

- Migration required: yes,041_sourcing_closeout and042_listing_expiry; frozen assets unchanged.
- Backfill/lock implications: add closeout table/immutability trigger and indexed expiry fields; legacy expiry remains null, new listing default30 days. No inventory ownership or accepted-deal rewrite. Native migration gate must run.
- Rollback or compensation: reviewed forward correction; terminal receipts/history preserved. Earlier images may reject newer migration ledgers. Do not reset database/volumes.
- Configuration/secrets changed: none; no dependencies or paid services.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author1,169 API unit cases, quality, workspace/browser types, API/web builds and strict native test compilation passed. Locale/frontend transport, authorization/branding/migration/backlog/risk checks passed; initial JavaScript73,128 gzip bytes remains within90KiB budget. Native cases cover ownership, expiry, insufficient inventory rollback, audit, same-buyer/crop award, failed audit rollback and concurrent closeout. Browser definitions cover denial/input preservation and durable terminal receipt. Docker/browser runtime is not claimed on author host. Exact-commit full release and required CI must pass before merge; add passing SHA/date and CI URL.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: no automatic claim that a trade fills the whole sourcing requirement; no signature or logistics qualification claim. Legacy no-expiry listings require explicit owner review to acquire a deadline. Renewal rejects pending offers and the UI explains this before confirmation.

## Follow-up work

- TRD-015: versioned bilateral agreement acceptance remains separate.
- PRD-007/008: notification center and expanded lifecycle emails.
- ENV/PER/OPS: hosted capacity, release evidence archive and operational acceptance.
- Logistics service-marketplace roadmap remains open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted125/343 (36.4%); target127/343 (37.0%) after full release/review/merge. Core11/28 and provider-inclusive11/40 unchanged. These are completion counts, not a valuation or safety measure.
