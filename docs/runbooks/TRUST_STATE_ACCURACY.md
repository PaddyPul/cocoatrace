# Trust-state Accuracy v1

This release repairs assurance claims rather than changing inventory or resetting customer data. Workspace approval controls access; it is not independent supplier verification. Conventional inventory remains sellable without organic certification.

## Sources and decisions

- New organizations default to pending; explicit workspace approval still permits sign-in.
- Farms/plots default to self-declared, deforestation risk to unknown, cutoff review to false, and evidence review to pending.
- Coordinates are supplied data, including valid zero coordinates. They never establish verified origin or EUDR compliance.
- Organic review requires a current scoped certificate, matching farm and farmer, matching crop and harvest date, and a real attestation by an approved independent certifier. A stored `attested` flag alone is insufficient.
- Origin requires an attributable independent farm review. EUDR requires an attributable whole-batch independent review and complete selected plot coordinates. Reviews by the source owner or current holder cannot count as independent.
- Malware clearance is not evidence approval. Evidence must have a current independent review record to contribute approved-evidence readiness.
- No general origin/EUDR/evidence approval UI is introduced here. Absent a real review, the app displays declared or unknown. Do not populate fabricated reviews to obtain a green badge.

## Architecture and audit

`api/src/modules/trust/assessment.ts` centralizes live claim assessment. Certificate write operations live in `certification.ts`; `writeReviews.ts` records review provenance and strict transactional audit events. Controllers delegate to these services. The web uses the shared `TrustClaims` component.

Migration 021 appends to the frozen migration history. `trust_claim_reviews` records the actual user and organization, source, method, review time, expiry and status. `trust_state_corrections` records each unsupported legacy decision and its correction. Existing approved workspace access is preserved. Deterministic farm/plot fixture flags remain reproducible but cannot grant effective verified labels.

Issuance, attestation and status changes commit with their audits. Suppliers cannot self-certify even with a broadly privileged role. Suspended certificates can be reinstated only while currently valid and with a new review record. Permanently revoked certificates require new issuance; suspension cannot bypass that restriction. Public passports avoid cached trust responses and redact private reference paths and emails.

## Operations

Run the normal migration startup, then `npm run trust:report` (or `npm run trust:report -- --details`) inside the API container. This command runs in a read-only repeatable-read transaction. A positive correction count is historical evidence that unsupported defaults were corrected; it is not an error and should not be erased. Review unexpected corrections rather than restoring unsubstantiated verified flags.

Keep a normal database backup before applying production migrations. Application Compose volumes must remain intact. Never reseed customer data or run `down -v` to clear findings. A rollback of application code must remain compatible with the forward schema; do not remove correction or review history.

## Validation and remaining scope

Authoring validation: 159 unit tests, API/web builds, browser type checking, migration integrity, seven mocked Chromium marketplace/trust cases, and 41 supplemental PostgreSQL/WASM integration cases passed. These comprise 30 existing boundary cases plus eight trust API cases and three migration cases. Supplemental execution is not native PostgreSQL race verification and does not exercise real S3/ClamAV infrastructure. Docker was unavailable in the authoring environment.

Required release gates: native Docker migration suite, full integration suite (65 cases), full browser suite (14 cases), GitHub quality gate, and the short smoke test in the Windows release guide. Keep backlog items in progress until those gates pass.

Certificate overlap prevention, independent reviewer accreditation checks beyond approved certifier workspace/permissions, general claim review workflows, proactive revocation notifications and existing deal remedies remain separate backlog concerns. This release does not assert legal compliance from a reviewed label.

## Buyer–supplier operating boundary

A farm and its plots are reusable source records, not separate published products. Direct conventional inventory stores `farm_id=NULL` and empty plot IDs; creating a farm earlier does not link it to later inventory. Listing presentation must use `source_mode` to distinguish declared inventory source/inventory lot from farm/plots/harvest. Optional certifier APIs are internal independent-review capabilities, not mandatory onboarding or trade actors. Suppliers can contribute externally issued documents; those documents remain unreviewed until an actual independent decision exists. General external-document review workflow remains an open backlog item.
