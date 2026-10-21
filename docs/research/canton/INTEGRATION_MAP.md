# CT-00: BetterTrade integration map and entry gates

Inspected main: `1c9afc564c1ea3013f5c6a2dd1c33c956c65a86f` (atomic audit release merged).
Status: inspection delivered; CT-00 stays IN PROGRESS until reviewed and accepted with this bundle. No Canton runtime exists or has been tested.

## Actual integration boundaries

| Concern | Existing source | Required integration constraint |
| --- | --- | --- |
| Authentication | `api/src/services/authSessionService.ts`, `api/src/middleware/auth.ts` | Existing application sessions are not ledger JWTs. Resolve actor and organization server-side; separate ledger audience, issuer and rights. |
| Live authority | `api/src/modules/mfa/assurance.ts`, `api/src/modules/mfa/reviewers.ts` | Preserve live identity/session/role checks, fresh assurance and lifecycle serialization. Never queue an authorization solely from captured HTTP permissions. |
| Offer creation/acceptance | `api/src/modules/trading/offers.ts`, `api/src/routes/listings.ts` | Acceptance locks recall boundary, holding, listings and offers, then reserves stock. Do not hold these database locks across a ledger/network call. |
| Contract, payment and shipment creation | `api/src/modules/trading/fulfillment.ts` | Acceptance already creates `sales_contracts`, payment requests/installments, fees and shipment in one transaction. Do not create another canonical trade or repeat these side effects after ledger completion. |
| Versioned commercial agreement | `api/src/modules/agreements/policy.ts`, `repository.ts`, `routes.ts`; migration `044_agreement_acceptance.ts` | Reuse/link `agreement_versions` and `agreement_acceptances` by contract/version. Current snapshot explicitly excludes payment protection/terms and is an acknowledgement, not a signed legal contract. |
| Hashing | `api/src/modules/agreements/policy.ts` | Existing v1 digest is SHA-256 of `JSON.stringify` of the ordered `commercialSnapshot` projection. It is not an established general canonical-JSON standard. Preserve existing hashes; define a new version and reproducible bytes if canonicalization changes. PostgreSQL JSONB key ordering must not be assumed to reproduce original bytes. |
| Transactions/audits | `api/src/services/databaseTransaction.ts`, `auditWriter.ts`; `api/src/modules/trading/transaction.ts` | Enqueue immutable ledger intent and ordinary audit in the same transaction; ledger confirmation requires actual update/completion evidence. |
| Existing outbox reference | `api/src/modules/feeStatementDelivery/service.ts`, `api/src/modules/payments/reminders.ts`, `api/src/modules/recall/notifications.ts` | Study retries, leases, live eligibility and unknown submission outcomes; do not treat existing SMTP semantics as a ledger deduplication guarantee. |
| Worker status | `api/src/modules/operations/worker.ts`, `jobs.ts`, `backlog.ts` | Separate opt-in job; no ordinary worker should fail because optional Canton dependencies are absent. |
| UX | `web/src/pages/OffersPage.tsx`, `DealRoomPage.tsx`, `DashboardPage.tsx`; `web/src/components/trading/DealNextAction.tsx` | Existing guided trade remains authoritative; show delayed/unknown honestly; preserve existing payment and transport gates. |
| Evidence | `api/src/services/evidenceUploadService.ts`, `api/src/modules/evidenceCleanup/` | Reference validated content digests only; no private file bytes, bearer URLs or automatic real-world-truth claims. |
| Migration/release | `api/migrations.manifest.json`, `api/scripts/check-migration-integrity.mjs`, `scripts/run-release-checks.mjs` | Latest migration is 051 at inspected main. Assign the next number only when implementing against then-current main; freeze applied files. Full `verify:release` remains mandatory. |

## Decisions the source document leaves unresolved

1. **Offer versus agreement timing.** The proposed pre-acceptance offer snapshot cannot directly be the existing commercial snapshot: contract ID and committed holding are created during acceptance. ADR-06/07 must choose an immutable pre-offer schema plus explicit linkage, or a post-contract bilateral acknowledgement PoC using existing agreement versions. Prefer the latter for the first isolated PoC, subject to review. Do not mark the supplier's earlier ordinary offer acceptance as a new ledger approval; obtain explicit approval of the exact ledger-bound version.
2. **Scope of verification.** Existing commercial acknowledgements exclude payment terms. A receipt may verify only the stated snapshot scope; it must not imply payments, delivery, fees or all later documents are verified.
3. **Authority after enqueue.** Record actor/session/organization and explicit consent, but do not store a raw session/ledger JWT in the outbox. Define how a party-scoped worker obtains a valid token, rechecks entitlement and handles expiry/revocation without letting the main backend mint both parties' approvals. If this cannot pass attack tests, CT-08/09 stay blocked.
4. **Canonical bytes.** Establish test vectors for decimal normalization, null/missing values, Unicode, schema versions and digest reproduction from stored JSONB. Retain original v1 receipt compatibility. Do not silently replace `snapshotHash`.
5. **Runtime compatibility.** The research references multiple Canton documentation versions. Version, license, API support, image digests, resource use and free Windows/Docker feasibility remain unverified; no runnable topology is promised by this map.
6. **Rights mapping.** The proposed mapping says UNIQUE `(organization_id, environment)` but omits `environment` from its field list. Add explicit environment/network identity and participant-local user mapping during schema design. Multiple users per organization need a separate user/entitlement association, not a single shared organization credential.
7. **Expiry.** Daml authorization alone does not enforce `expiresAt`. CT-05 must implement and test ledger-time expiry checks, consumption on accept/reject/cancel and replay behavior on the pinned SDK.
8. **Evidence verification.** Offline hash validation, signed gateway attestation and direct authorized ledger verification are distinct results. A syntactically valid receipt is never sufficient to display confirmed ledger status.

## Execution and acceptance

The master backlog tracks CT-00 through CT-18 once each. All belong to a P2 optional research epic; P0 labels inside the source specification mean mandatory PoC exit gates, not MVP launch blockers. CT-16 is the independent-authority extension; CT-18 is provenance expansion. Tier 1 remains centrally managed authorization.

Order: CT-00 review -> CT-01 ADR/threat model -> CT-02/03/04/05 isolated infrastructure and authority proof -> CT-06/07 gateway/outbox -> CT-08/09/10 integration and recovery -> CT-11/12 UX and verification -> CT-13/14/15 hardening/release -> optional CT-16/17/18 according to their dependencies. CT-17 operational runbooks should accompany each slice and complete before claiming a reproducible PoC.

No new paid provider, mainnet, public ledger port, production credential, cryptocurrency or payment custody is authorized. Feature defaults off; current MVP work and its full release gate continue independently.
