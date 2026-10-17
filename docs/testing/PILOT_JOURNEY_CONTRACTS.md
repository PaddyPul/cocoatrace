# Pilot journey and adapter verification

QLT-010/012/014 candidate. Runtime browser/native acceptance remains required.

| Evidence | Real customer actions exercised | Explicit setup or limitation |
| --- | --- | --- |
| e2e/supplierPublishingJourney.spec.ts conventional | Create25kg inventory, attach scanned PDF, publish USD4.25/kg FOB listing, reload persisted terms and no invented farm/organic claim | Real identity/onboarding helper; no intercepted API responses |
| Same file, source/organic | Create farm and plot, record100kg farm harvest, attach PDF, publish and show independent review attribution/reference | Guarded disposable SQL creates independent certifier/certificate/attestation only; does not test certificate issuance or certify a real reviewer. Current harvest UI links the farm, not a selected plot; no field-level plot linkage claim |
| e2e/deliveryExceptionJourney.spec.ts | Buyer uploads damage proof/reports full-quantity damage, supplier proposes resolution, buyer approves and inspects, submits deferred payment, seller verifies; reloads and exact one-transfer/one-fee settlement | Real API setup of inventory/listing/accepted trade/terms/milestones. External replacement is an explanation, not a platform-managed return/replacement/refund workflow |
| e2e/recallResponseJourney.spec.ts | Buyer acknowledges, over-accounting is rejected with draft preserved, server rejects bypass without a saved record, corrected accounting succeeds; supplier proof/resolution and retained returned/destroyed stock remain exercised | Existing inventory/custody/activation setup APIs and scoped setup-only custody permission helper |
| api/src/testing/adapterContracts.test.ts | Checked current implementation inventory; protocol-level SMTP failures/readiness/deadlines/redaction | Local loopback relay, not external inbox delivery. See ADAPTER_CONTRACTS.md for existing real storage/scanner runtime evidence and future admission rules |

These tests complement accepted source creation, trust presentation, shortage/prepayment and every-plan journeys. They test the currently implemented product; they do not add or claim partial settlement, refunds, logistics service providers or a customer blending workflow. Role-control absence is checked alongside actual server behavior and existing native authorization suites; it is not a replacement for the full resource matrix or independent review.

All new .spec files are automatically discovered by the existing disposable browser runner. Adapter checks are included in the normal API unit gate. No new migration, dependency, route, production permission or customer behavior change. Use the guarded full release command in releases/PILOT_JOURNEY_CONTRACTS_WINDOWS.md; retain the exact passing SHA and required CI before merge.
