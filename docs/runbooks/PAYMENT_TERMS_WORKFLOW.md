# Payment terms workflow boundary

Backlog: ARC-006, ARC-019, QLT-007. These items remain partial.

The contract HTTP controller handles input/output; modules/payments/terms.ts owns proposal and agreement. Routes retain their existing request validation. The service uses typed contract/payment projections, existing installment/dispatch policy and the shared transaction boundary. No migration, commercial plan, deposit default, fee policy, monetary rounding or external money movement is introduced.

Every mutation locks the seller/buyer scoped contract before its payment request, matching installment and settlement lock ordering. Missing and unrelated-tenant records return the same 404 response. Cancelled/settled contracts reject changes with 409. Agreement retries return alreadyConfirmed without deadline activation or duplicate audit. Replacing agreed terms or terms with submitted/paid installments remains blocked. Mutations and critical audit records commit or roll back together.

Verification includes 23 workflow unit regressions plus API integration cases for party/tenant authorization, retry/deadline preservation, immutable agreed terms, closed-contract protection and simultaneous confirmation. Existing browser journeys exercise all five payment plans. Unit mocks prove orchestration and rollback requests; native PostgreSQL is required to prove persisted outcomes and concurrency. Run npm run verify:release before merging.

This is a focused architecture step before delivery remedies. Partial settlement, refunds, cancellation, returned-stock handling, currency arithmetic and remaining payment/evidence/recall refactors remain separately tracked. It does not move funds or settle a disputed trade.
