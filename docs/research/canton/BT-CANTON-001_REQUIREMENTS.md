# BT-CANTON-001 — Canton/Daml Trade Authorization and Verification Integration

> Imported founder research on 2026-10-21. The CT-00 integration map records repo-specific corrections and unresolved decisions. Referenced runtime versions, URLs and topology have not been revalidated by this implementation bundle. Internal P0 labels are PoC exit gates; the epic remains optional P2.

**Project:** BetterTrade / Research Food Provenance MVP (formerly CocoaTrace)  
**Work item:** BT-CANTON-001  
**Type:** Architecture spike + isolated custom integration + security proof of concept  
**Priority:** P2 strategic R&D (must not block current MVP launch/release)  
**Status:** Proposed / not implemented or tested  
**Target:** Local self-hosted demonstration using Docker, followed by a documented option for hosted validation  
**North-star:** A buyer and supplier approve the same traceable trade through the existing BetterTrade UI, and an auditor can verify the resulting ledger record without exposing private trade data.

## 1. Problem statement

BetterTrade currently authenticates users in its application, scopes offers to organizations, creates sales contracts upon acceptance, and records audit events. These actions do not automatically establish independent Canton/Daml party authorization. The proposed integration must introduce ledger identities, rights, secure JWT issuance, Daml transactions, business-to-ledger state mapping, and verifiable receipts while preserving the current simple UX and not breaking the live trade workflow.

**Fundamental distinction:** A JWT authenticates a caller to a Canton participant and carries or resolves ledger rights. It is **not** a human's cryptographic signature on an agreement. If BetterTrade controls both parties' credentials or their administrators, it can potentially submit for both sides. The PoC must state which trust properties it proves and must not misrepresent centrally managed permissions as independent user consent.

## 2. Goals and explicit non-goals

### Goals
- G1: Demonstrate two separate Canton parties, BuyerOrg and SupplierOrg, on separate local participant nodes, connected to one test synchronizer.
- G2: Preserve existing BetterTrade login, roles, organization-scoped offer acceptance, and normal dashboard interaction; no wallet setup, Canton Coin or seed phrases for users.
- G3: Validate short-lived JWTs issued by an OIDC provider; map participant-local ledger users and `CanActAs`/`CanReadAs` rights to verified organizations.
- G4: Use Daml propose -> accept -> bilateral agreement, with unauthorized submissions rejected at both application and ledger layers.
- G5: Store document/evidence hashes and trade linkage without publishing personally identifying or commercially confidential data to a public network.
- G6: Reconcile submitted, pending, accepted, rejected and timed-out ledger commands with BetterTrade; preserve an unambiguous audit trail.
- G7: Produce verifiable receipts and allow authorized counterparties/auditors to validate contract state and evidence hashes through a controlled verifier.
- G8: Demonstrate revocation, token expiry, duplicate handling, restart/recovery, privacy restrictions, tamper detection and malicious backend attempts.
- G9: Preserve existing `npm run verify:release` and native merge/release checks; the PoC must be optional and separately gated.

### Non-goals
- NG1: Real cryptocurrency, token issuance, escrow, settlement of fiat funds, or regulated financial custody.
- NG2: Mainnet/Global Synchronizer production deployment in this bundle.
- NG3: Replace the BetterTrade identity provider, database or entire offer/payment/shipment workflow.
- NG4: Put full certificates, farmer profiles, prices, identities or personal data on a public chain.
- NG5: Claim self-hosting both participant nodes creates independent institutional control.
- NG6: Claim blockchain by itself proves the real-world origin, truth of certificates, human intent, or real-world delivery.

## 3. Research/architecture decisions (mandatory ADRs before feature implementation)

| ADR | Decision to record | Default for PoC | Decision gate |
|---|---|---|---|
| ADR-01 | Canton version, SDK, license, Ledger API v2 support | Pin known-compatible, currently supported versions with lockfile/image digests | `daml build`, API client integration and docs pass |
| ADR-02 | Self-hosted topology | Buyer participant, Supplier participant, synchronizer (sequencer + mediator), persistent databases, separate OIDC tenants/clients or equivalent isolation | Restart and rights isolation tests pass |
| ADR-03 | Identity organization scope | One Party per verified organization for PoC; several authorized human users may represent it | Organization switching and suspension tests pass |
| ADR-04 | JWT mode | OIDC/JWKS; distinct ledger API audience; participant users with scoped rights | Forged, wrong-audience, expired, revoked tests pass |
| ADR-05 | Human approval / trust tier | Tier 1: user-scoped access controlled by BetterTrade and IDP; Tier 2: independent supplier issuer/admin or controlled signer | Explicitly label Tier 1 as delegated/managed, not nonrepudiable |
| ADR-06 | Contract data | Immutable agreement snapshot hash + opaque identifiers + selective business fields | Privacy review and hash reproducibility pass |
| ADR-07 | Write path | DB outbox -> ledger command worker -> ledger completion/update consumer | No DB/ledger dual-write inconsistencies after injected faults |
| ADR-08 | Feature gating | Default off; org/test cohort allowlist; no implicit fallback that claims ledger success | Legacy flow unchanged with flag off |
| ADR-09 | Proof UX | Authenticated verification receipt; separately shareable redacted check if permitted | Nonparticipant cannot retrieve hidden terms |
| ADR-10 | Read authority | `CanReadAs` distinct from `CanActAs`; no wildcard rights in app runtime | Negative permission matrix passes |

## 4. Reference architecture

```
Browser (Buyer or Supplier)
   | current BetterTrade auth / optional step-up for acceptance
BetterTrade API (requireAuth + organization RBAC + offer state machine)
   |--- PostgreSQL: offers, sales_contracts, audit_events
   |--- transactional outbox: canton_ledger_operations
   `--> Canton Integration Worker / Gateway (private network)
          |--- JWT verifier and scoped token acquisition (OIDC/JWKS)
          |--- Party/participant mapping + Ledger API client
          |--- buyer participant (Ledger API, user rights)
          |--- supplier participant (Ledger API, user rights)
          `--- test synchronizer (sequencer, mediator)
                       |
               Ledger update consumer
                       |
              reconciliation + verifiable receipt
```

For independent-authority Tier 2, transfer supplier control to a separate organization-operated participant/IdP or independently controlled signer with no BetterTrade minting/admin capabilities. A second node on the same BetterTrade-controlled server is NOT enough.

The official Canton/Splice LocalNet includes more components than the minimum private PoC; select the smallest supported topology and do not treat development LocalNet as production infrastructure.

## 5. Security and authorization requirements

**SEC-01** All Ledger API calls use TLS outside loopback; admin endpoints not publicly reachable; use mTLS where supported; store secrets only in managed secret stores / development-only untracked secrets.

**SEC-02** JWT validation MUST check signature against trusted JWKS, `iss`, `aud`, expiry, not-before (if applicable) and intended principal; reject missing token and algorithms not explicitly configured. Never trust an unsigned JWT or decode-only token check.

**SEC-03** There must be no shared runtime JWT or ledger user with `CanActAs(BuyerOrg)` AND `CanActAs(SupplierOrg)`. No participant admin, wildcard or any-party rights for normal web/backend operation.

**SEC-04** The main application service account may read approved derived states and request processing, but cannot impersonate both counterparties or provision its own authorizing JWTs.

**SEC-05** Token acquisition must preserve actor identity and meaningful approval. For Tier 1, if the backend brokers session tokens, record that it is *managed authorization* and explicitly test administrator impersonation limits. Never conflate an app session JWT with the ledger-specific access token.

**SEC-06** Bind requests to `bettertrade_user_id`, `organization_id`, `participant_id`, `party_id`, `trade_id`, `offer_version` and accepted snapshot digest; deny if any mismatch. Never accept an arbitrary caller-supplied party ID as authority.

**SEC-07** Approval must be intentional: re-display terms, require a clear Accept action, capture timestamp, actor ID, organization, document version, evidence digest, application session and optional step-up auth. Do not store raw JWTs or passkey secrets in audits.

**SEC-08** Revocation: suspension of organization, member removal, role change or revoked ledger access prevents future sensitive commands. Define maximum token lifetime and how existing sessions are invalidated. Test both app and participant denial; acknowledge already finalized ledger actions cannot be revoked retroactively.

**SEC-09** `CanReadAs` must not imply `CanActAs`; read visibility follows Daml signatory/observer roles. Counterparty data must not leak in unauthorized APIs, event subscriptions or public verification pages.

**SEC-10** No claim of cryptographic nonrepudiation by individual users in Tier 1. The proof report must identify the exact administrators who can create, mint, change rights or recover keys.

## 6. Daml model (minimal, separate package)

Package `bettertrade-canton-poc` with:

1. `TradeProposal`: signatory `buyer`; observer `supplier`; fields `tradeExternalId`, `offerExternalId`, `snapshotHash`, `termsVersion`, `evidenceDigest`, `expiresAt` and optional minimal nonprivate metadata. Buyer-controlled `Cancel`; supplier-controlled `Accept` and `Reject`.
2. `TradeAgreement`: signatories `buyer, supplier`; fields include immutable proposal identity, exact snapshot digest and acceptance metadata that do not expose sensitive plaintext unnecessarily.
3. Optional `VerificationAttestation`: issuer is a designated `Verifier` or BetterTrade audit party; records digest, agreement reference, attestation type and version; strictly distinguish this from certifying real-world truth.
4. Optional proof-of-concept `AgreementClosed` or `TradeFulfillmentAcknowledgment`, controller under explicit buyer/supplier rules. Do NOT import money movement or transport controls into scope.

**Daml authorization invariant:** Buyer creates proposal using buyer authority; supplier accepts using supplier authority. The proposal's signatory authority and supplier choice controller support creation of the bilateral agreement; buyer alone must not be able to directly create a bilateral agreement. Both must have ledger visibility as configured. Separate archive/expiration/cancel/rejection flows should be explicitly modeled and tested.

**Daml tests:** buyer proposal succeeds; seller proposal unauthorized; buyer cannot accept own proposal; unrelated third party cannot accept; seller accepts once; second acceptance fails; canceled/expired proposal cannot be accepted; agreement has both signatories; observer visibility matches policy; invalid snapshot/replay/version rejected where applicable. Daml `Script` tests should not require the web app.

## 7. Database and integration contracts

Add migrations following current repo migration conventions after inspection, not hardcoded migration numbering:

- `canton_party_mappings`: `id`, `organization_id`, `participant_alias`, `party_id`, `ledger_user_id` (optional per-user association), `status`, `provisioned_at`, `revoked_at`, `metadata_version`, UNIQUE (`organization_id`, `environment`). Party IDs are opaque; never derive from org names.
- `canton_ledger_operations`: `id`, `trade_id`, `offer_id`, `operation_type`, `requester_user_id`, `acting_organization_id`, `party_id`, `request_digest`, `idempotency_key` UNIQUE, `state` (`queued`, `submitted`, `confirmed`, `rejected`, `unknown`, `reconciling`), `command_id`, `submission_id`, `error_code`, `created_at`, `updated_at`.
- `canton_contract_links`: `id`, `trade_id`, `agreement_version`, `participant_alias`, `contract_id`, `template_id`, `agreement_digest`, `ledger_offset_or_checkpoint`, `active`, `created_at`.
- `canton_verification_receipts`: `id`, `trade_id`, `agreement_digest`, `proof_version`, `receipt_json`, `visibility`, `created_at`.
- `canton_sync_checkpoints`: consumer identity and safely restartable stream position.
- Reuse existing audit-event system: `ledger.proposal_submitted`, `ledger.proposal_confirmed`, `ledger.acceptance_attempted`, `ledger.agreement_confirmed`, `ledger.verification_passed/failed`, `ledger.permission_denied`, `ledger.reconciliation_alert`.

Do not overwrite existing `sales_contracts` or invent a second competing canonical trade. Link ledger agreement to the existing sale contract with explicit agreement version and verified status.

### Internal APIs (illustrative; follow actual repo route conventions)

| Endpoint | Auth | Result |
|---|---|---|
| `GET /api/canton/status` | admin / health redaction | Feature state and dependency health, never secrets |
| `POST /api/canton/organizations/:id/provision` | platform admin with approval | Provision/reconcile org-to-party mapping (idempotent) |
| `POST /api/trades/:id/ledger-proposal` | buyer org `offer.create` equivalent | Queue proposal for currently authorized immutable offer snapshot |
| `POST /api/trades/:id/ledger-accept` | supplier org `offer.respond` equivalent + step-up if enabled | Queue/safely complete seller acceptance |
| `GET /api/trades/:id/ledger-status` | authorized counterparties | Pending/confirmed/rejected/reconciliation needed |
| `GET /api/trades/:id/verification-receipt` | authorized counterparties/auditor | Signed or attestable versioned proof without JWTs |
| `POST /api/canton/verify` | explicit permitted verifier identity or restricted public mode | Verify receipt digest and actual ledger state through gateway |
| `POST /api/admin/canton/reconcile` | admin + rate limit | Reconcile incomplete operations; must not submit arbitrary party actions |

Do not expose raw Ledger API/Admin API ports in browsers or internet-facing routes.

### Idempotent command strategy

Generate stable `command_id` from immutable operation ID; use a request digest bound to trade, accepted offer version, organizations and acting party. Queue DB outbox in same transaction as business intent; let worker submit and correlate completions; persist offsets/checkpoints; avoid falsely displaying success on a gRPC timeout. Reconcile unknown outcomes before retries. A DB operation reaching `confirmed` must reference actual ledger completion/event evidence.

## 8. Business-state and UX integration

1. Buyer chooses/sends offer in existing UI. Application snapshots terms as canonical versioned JSON, computes hash, records ordinary DB offer state. If canton feature enabled, show `Ledger verification pending`; queue proposal without blocking current marketplace where flag is disabled.
2. Supplier views offer through their ordinary dashboard and sees *exact* terms that will be accepted. Clicking Accept triggers current RBAC and explicit approval, then a supplier-scoped ledger command. No JWT or Party ID appears in normal UI.
3. The existing `sales_contracts` creation behavior must be explicitly selected through an ADR: for flagged PoC trades, either await ledger confirmation before setting `ledger_verified`, or keep current contract state and show `verification pending` until confirmed. Never label ledger verified before completion.
4. After confirmation, show `Verified on Canton (test network)` with date, version and a `View verification receipt` link. Preserve existing dashboard next-action and auto-redirect behavior.
5. Verification screen: show trade ID, version digest, both *organization display names* only to viewers permitted by existing privacy rules, ledger status, relevant contract ID/participant/synchronizer network context, ledger update reference and `Verify again`. Provide copy/download of redacted receipt and inspectable JSON for technical auditors.
6. If the ledger is unavailable, show an honest `Verification delayed` state with retry/reconcile handling. Do not block standard user work outside deliberately flagged demo trades. No silent fallback implying the action reached Canton.
7. Offer revisions require a new digest/version and prior state cancellation/expiry path. Never silently attach a previous confirmation to newly edited terms.
8. Supplier dashboard next action displays `Review and accept`, then `Awaiting verification` or `Trade agreement verified`, preserving the existing flow toward payment terms and fulfillment without claiming those stages are on-ledger.

## 9. Verification model and evidence

**The auditor verifies:**
- Which hash and schema/version were committed to the ledger.
- That the live contract or historical event was produced by the Daml workflow with buyer/seller party authorization.
- That the agreement snapshot shown in BetterTrade hashes to the committed digest using a documented canonicalization algorithm.
- That the participant query proves status for an authorized auditor (or via a signed gateway attestation if the auditor cannot independently query the ledger).
- That the receipt's own signature and issuer key are valid (when using signed receipt format).

**The auditor cannot infer from this PoC alone:** that a real human personally clicked Accept, that farm data is physically true, that cleared funds exist, or that BetterTrade admins lacked control of both identities unless independent governance controls are demonstrated.

### Proof package

`verification-receipt-v1.json` schema:
```
{
  "schemaVersion": "1",
  "environment": "local-canton-poc",
  "betterTradeTradeId": "synthetic-trade-id",
  "offerVersion": 1,
  "agreementHashAlgorithm": "SHA-256",
  "canonicalization": "documented-canonical-json-v1",
  "agreementDigest": "hex-encoded-hash",
  "ledger": {
    "participantAlias": "seller-participant",
    "synchronizerAlias": "poc-synchronizer",
    "templateId": "package:Module:TradeAgreement",
    "contractId": "opaque-ledger-contract-id",
    "updateReference": "ledger-update-id-or-offset"
  },
  "authorizationModel": "managed-user-scoped-jwt",
  "verificationStatus": "confirmed",
  "verifiedAt": "ISO-8601 timestamp",
  "receiptIssuer": "bettertrade-poc-verifier",
  "receiptSignature": "optional-signature-over-canonical-receipt"
}
```

Build CLI verifier `verify-canton-receipt` and authenticated web verifier. The CLI verifies hash canonicalization, receipt signature if present and, when supplied authorized ledger access, ledger agreement and status. A gateway-only receipt must be labeled as such, not as independent direct ledger verification. Tamper one byte in the terms JSON and prove verification fails.

## 10. Detailed implementation backlog

All tasks must have unit/integration/e2e tests and follow repository conventions. IDs are stable; status initially TODO.

| ID | Priority | Task / output | Definition of done |
|---|---|---|---|
| CT-00 | P0 | Inspect repo identity, offers, contract, audit, migrations, existing release scripts; write integration map | Exact files/routes/migrations documented; zero changes to existing behavior |
| CT-01 | P0 | ADR pack for network, JWT, trust tiers, org-to-party scope, version pinning, authoritative state | 10 ADRs accepted, threat model attached |
| CT-02 | P0 | Docker Compose private Canton stack with buyer/seller participants, synchronizer, persistent stores | One-command up/health/down; network isolated; restart passes |
| CT-03 | P0 | OIDC/JWT issuer config (Keycloak or existing compatible IdP) and JWKS integration | Valid user access works; expiry/wrong audience/issuer/signature denied |
| CT-04 | P0 | Ledger party provisioning and participant Ledger API user-rights management | Buyer and seller mappings stable; no cross-actAs rights; rights audit available |
| CT-05 | P0 | Daml package: proposal/accept/reject/cancel/agreement | Build and authorization tests pass with separate parties |
| CT-06 | P0 | Narrowly scoped ledger client / gateway and health diagnostics | Can submit/query without web-admin or participant-wide credentials |
| CT-07 | P0 | Migrations and idempotent transactional outbox | Repeat submissions produce only one logical operation; rollback safe |
| CT-08 | P0 | Buyer proposal API integration with existing offer/version snapshot | Buyer role success; seller/unrelated party denied |
| CT-09 | P0 | Supplier approval integration + step-up/explicit approval | Seller role success; buyer cannot accept; terms hash fixed |
| CT-10 | P0 | Update consumer, checkpoint and DB reconciliation | Survives restart, timeout, missed event and duplicate completion |
| CT-11 | P0 | UI: verification pending / confirmed / failed / receipt | Works in existing dashboards, mobile and role-scoped views |
| CT-12 | P0 | Receipt generator + web verifier + CLI verifier | Authorized direct ledger verification; invalid digest fails |
| CT-13 | P0 | Automated adversarial authorization suite | Negative matrix in §11 passes |
| CT-14 | P0 | End-to-end demo with synthetic buyer/supplier accounts | All stages recorded with screenshots/logs, no fake payment claims |
| CT-15 | P0 | Release gate integration and documented rollback | `npm run verify:release` passes; flag off restores normal flow |
| CT-16 | P1 | Tier 2 separately administered supplier issuer/participant proof | BetterTrade admin cannot mint supplier rights or accept via its credentials; prove by attack test |
| CT-17 | P1 | Ops runbook, monitoring, backups, upgrade/reset and rotation | Another developer can reproduce/restore PoC |
| CT-18 | P2 | Optional farm/lot/certificate provenance digest linkage | Only already-validated evidence hash linked, no PII leakage |

## 11. Verification matrix / required test scenarios

| Test ID | Scenario | Expected |
|---|---|---|
| AUTH-01 | Buyer valid token creates proposal | Succeeds |
| AUTH-02 | Seller tries buyer proposal | Denied at app/ledger as appropriate |
| AUTH-03 | Buyer tries seller accept | Denied by Daml controller and/or ledger API permissions |
| AUTH-04 | Unknown Org C tries accept/read | Denied, no private trade leakage |
| AUTH-05 | Backend service uses its ordinary machine JWT as supplier | Denied |
| AUTH-06 | Token expired, wrong audience, wrong issuer, tampered signature | Rejected |
| AUTH-07 | `CanReadAs` token submits a command | Rejected |
| AUTH-08 | Suspended supplier member tries acceptance | Rejected immediately at application boundary; ledger revocation effective per runbook |
| AUTH-09 | Attempt to submit using a caller-supplied organization/party ID | Rejected |
| AUTH-10 | Tier 2 BetterTrade administrator attempts to mint supplier JWT/change supplier rights | Rejected by independent controls |
| LEDGER-01 | Buyer creates proposal; supplier accepts | Bilateral active agreement with expected digest |
| LEDGER-02 | Duplicate click / repeated idempotency key | One logical agreement; UI stable |
| LEDGER-03 | Buyer cancels proposal before supplier accepts | Later acceptance fails |
| LEDGER-04 | Supplier rejects proposal | No bilateral agreement |
| LEDGER-05 | Terms edited after proposal or signature | Old receipt fails for changed terms; explicit new version needed |
| LEDGER-06 | Unapproved direct creation of both-signatory agreement | Rejected |
| SYNC-01 | Ledger unavailable mid-submit | Honest pending/unknown state; safe reconciliation |
| SYNC-02 | DB commit succeeds but ledger submit fails | Outbox retries; no false verification |
| SYNC-03 | Ledger accepts but response times out | Query/reconcile detects completion; no duplicate agreement |
| SYNC-04 | Restart ledger participant/integration worker | Restore from persistent state and offsets; no duplicates |
| VERIFY-01 | Authenticated buyer validates receipt | Valid |
| VERIFY-02 | Authorized auditor verifies on same ledger | Valid with correct rights |
| VERIFY-03 | Change one byte of agreement file | Invalid digest |
| VERIFY-04 | Forge or alter signed receipt | Signature fails |
| VERIFY-05 | Anonymous viewer requests private agreement | Private fields unavailable |
| LEGACY-01 | Canton feature flag off | Existing offer acceptance, payment and shipping unaffected |
| LEGACY-02 | Existing release verifier | Passes with complete summary and matching commit |

## 12. Quantitative exit criteria

- 100% of mandatory negative authorization tests pass (no bypass in P0 scenarios).
- All ledger writes require explicit party-scoped rights; ordinary app machine identity has no buyer/supplier `CanActAs` permissions.
- 100% of successful demo agreements have immutable snapshot digest linkage and ledger-confirmed receipt; zero falsely reported confirmed writes.
- Repeated action and worker restart tests create no duplicate logical agreements.
- UI never asks an ordinary demo buyer/supplier to install a wallet, acquire Canton Coin or manually handle JWTs.
- A read-only authorized auditor can independently verify at least one agreement through a ledger-facing workflow; signed gateway receipts are labeled as mediated evidence.
- All tests use synthetic organizations, users, trades and certificates. No production credentials or data.
- Existing release suite stays green and full rollback is demonstrated with the feature flag disabled.

## 13. Demo script (recordable and reproducible)

1. Start Docker services; show healthy buyer participant, seller participant, synchronizer, OIDC and integration worker.
2. Login to BetterTrade as Buyer A. Create synthetic cocoa trade offer from an existing traceable lot; display stable snapshot digest.
3. Show ledger-side `TradeProposal` created and buyer's role; show supplier can observe proposal.
4. Login as Supplier B in another browser profile; inspect exact terms and choose Accept.
5. Show `TradeAgreement` confirmed, both parties as signatories, original digest unchanged, corresponding BetterTrade sales-contract link.
6. As Buyer A, try to perform seller's accept action; demonstrate denial.
7. As a standard backend service, try to act as Seller B; demonstrate denial. Clearly disclose remaining PoC admin/IDP impersonation powers.
8. Generate receipt, verify it in the authenticated app and CLI, then alter one byte of source terms and show a mismatch.
9. Simulate ledger unavailable and restart; demonstrate honest pending state/reconciliation.
10. Disable flag and run normal trade acceptance and release checks; no disruption.
11. If Tier 2 built: use an independently controlled supplier IDP/participant and demonstrate that BetterTrade-controlled admin rights cannot authorize the supplier's ledger action.

## 14. Security threat model and residual risks

| Threat | Control | Residual concern |
|---|---|---|
| Server impersonates both parties | Separate actAs rights, separate participant admin, optional independent issuer/signer | Central operator can impersonate users if it controls both identity/key domains (Tier 1) |
| JWT theft/replay | TLS, short expiry, secure server-side storage, bounded audience, session invalidation | Stolen unexpired bearer tokens remain usable unless stronger PoP/token-bound methods provided |
| Privilege escalation | No wildcard/participant admin rights for runtime services; entitlement tests | Privileged admin remains powerful |
| Forged source evidence | Canonical hashes + verifiable logs + issuer provenance | Blockchain cannot validate real-world facts |
| Agreement changed after acceptance | Versioned snapshots and hash checks | UI must prevent confusing old/new versions |
| Data disclosure | Keep sensitive payload off public network; role-based visibility | Local operator may still access own participant DB depending on control |
| Drift between DB and ledger | Outbox, completion stream, reconciliation, alerting | Operational incidents require runbook |
| Party loss/revocation | Identity lifecycle controls, organization holds | Ledger history remains immutable; older contracts persist |

## 15. Release packaging and Windows instructions

Suggested repo layout **after inspection**, adapting to existing conventions:

```
infra/canton-poc/                 # compose, config templates, scripts
contracts/canton/                # daml.yaml, Daml sources and Script tests
apps/api/src/integrations/canton/ # gateway, outbox worker, client, reconcile
apps/web/src/...                 # existing trade verification UI
scripts/canton-poc/              # install/start/stop/seed/verify/demo
research/adr/canton/             # threat model, topology and ADRs
test/integration/canton/         # JWT, role and synchronization integration tests
test/e2e/canton/                 # complete buyer/supplier journey
```

The paths above are targets, not assertions about the current codebase. Preserve existing implementation conventions. Provide PowerShell launch helpers for Windows 10 + Docker Desktop Linux containers, configurable `.env.example`, named volumes, health checks and deterministic synthetic fixtures. Pin images and keep secrets out of Git. Provide `start`, `seed`, `test`, `verify-receipt`, `reset`, `stop` and `logs` scripts. `reset` must explicitly warn that it destroys only isolated PoC volumes.

Merge via isolated branch, check diff, run Daml unit tests, API integration, E2E and `npm run verify:release`; inspect the existing `release-test-results/summary.json` status/commit match before merge. Do not fabricate passing results, deploy into live workflows, or bypass failing tests. Include PR description with design, screenshots, test matrix, trust-tier limitations, observed resource use and rollback.

## 16. Definition of Done / ship decision

**PoC is complete when** CT-00–CT-15 pass; the demo script is reproducible; invalid approvals are denied; receipt verification is real; rollback has been demonstrated; the code and docs are committed; security limitations are disclosed.

**Tier 2 is complete separately when** CT-16 proves independent issuer/participant administration outside BetterTrade control. Do **not** label Tier 1 as independent nonrepudiation.

**Do not deploy to production** until there is a fresh review of IAM ownership, runtime security, provider costs, retention/privacy, incident response, validator maintenance, legal evidence value, independent partner administration and whether Canton materially outperforms the existing audited database for the intended customer.

## 17. Suggested execution bundles

- **Bundle A — Architecture & Isolated Ledger:** CT-00 through CT-05. Deliver ADRs, Docker topology, JWT validation, party/user provisioning and authorization-tested Daml model.
- **Bundle B — BetterTrade Integration:** CT-06 through CT-11. Deliver gateway, migrations, outbox, role-scoped API commands, reconciliation and dashboard statuses.
- **Bundle C — Verification & Hardening:** CT-12 through CT-15 and CT-17. Deliver receipt verifier, attack suite, recorded demonstration, Windows scripts, release gate and rollback.
- **Bundle D — Independent Trust Extension (optional):** CT-16 and CT-18. Third-party-controlled signing/identity and sourced evidence integration.

**Sequencing rule:** First complete Bundle A's JWT and authority attack tests. Stop and redesign if the normal backend can obtain both parties' authorization contrary to the declared trust model. Do not compensate for the defect through UI copy or Daml assertions.

## 18. Reference documentation (verified October 2026)

- Canton ledger users and parties: https://docs.digitalasset.com/build/3.4/explanations/parties-users.html
- Canton JWT API authentication: https://docs.digitalasset.com/operate/3.3/howtos/secure/apis/jwt.html
- Ledger API v2 permissions and user management: https://docs.digitalasset.com/build/3.4/reference/lapi-proto-docs.html
- Daml proposal/accept model: https://daml.run/docs/daml/multi-party-workflows/
- Daml authorization rules: https://daml.run/docs/daml/authorization-and-visibility/
- Canton node TLS/security guidance: https://docs.digitalasset.com/operate/3.3/howtos/install/release.html
- Canton development LocalNet: https://docs.global.canton.network.sync.global/app_dev/testing/localnet.html

*Implementation caveat: API/version compatibility and exact repo paths require confirmation during CT-00 and CT-01. This is a requirements specification, not a claim that the integration has been built or tested.*
