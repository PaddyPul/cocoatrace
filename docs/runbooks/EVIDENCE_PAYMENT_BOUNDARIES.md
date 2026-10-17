# Evidence and payment domain boundaries

## Evidence download ownership

The evidence HTTP controller delegates upload intent/completion to existing services and private download response handling to evidenceWorkflow/httpResponse.ts. Download metadata SQL lives in repository.ts; policy.ts decides existing not-found/relationship/scan/review/payment-release denials; download.ts prepares a framework-free authorized transfer lease; storage.ts reuses the current private storage adapter and bounded legacy-file reader. Only the response adapter depends on Express.

The lease is acquired after metadata/relationship/release checks and before reading bytes. It remains held while either storage work or HTTP response completion is pending. Close/finish are idempotent; storage rejection and response errors release once. A client already disconnected during authorization is recognized before the storage read. Content type, attachment disposition, no-store and short admission Retry-After behavior remain. Legacy files remain confined to the same api/uploads root in source and compiled layouts.

No public object URL, expiring download grant, streaming implementation or new access permission is added. Existing uploader/entity relationship, scan-clean/rejected review and buyer protected-document payment rules are preserved. UPL-010 link expiry, broader evidence review/retention and multi-instance transfer admission remain open. This extraction does not certify every upload-service internal boundary or all other controllers.

## Payment transition ownership

| Domain owner | Existing state responsibility |
| --- | --- |
| requests.ts + requestPolicy.ts | Seller-scoped creation; closed/duplicate/money guards; awaiting_terms request and awaiting_trigger installments; shared five-plan agreed-state selection |
| terms.ts | Proposed and agreed terms, confirmed-party scope and immutable-after-activity safeguards |
| dueDates.ts | Matching trigger activates installments to due; durable deadlines preserved on retry |
| installments.ts | Due to payment_submitted to paid; seller rejection returns due with reason; reference-bound retry behavior |
| documentsAndSecurity.ts | Valid document presentation triggers due; security submission/verification and release conditions |
| issueGuard.ts + issues.ts | Active issue hold and bilateral proposal/approval |
| services/paymentProtection.ts | Exact installment amounts, required-before-dispatch and security gate policy |
| services/tradeSettlement.ts | Completion only when current payment/delivery/custody conditions permit |

Payment HTTP handlers contain no payment creation SQL or transition decisions. The remaining creation transaction uses the same seller contract lock, PostgreSQL rounded total, recorded currency/precision, installment triggers, release updates and atomic audit. Existing creation response returns the original inserted awaiting_terms row even if agreed-term activation updates the persisted state; that historical behavior is preserved, not silently redesigned.

No funds movement, payment-provider integration, invoice/tax approval, new settlement state or dispatch exception is introduced. Other controller/query adoption remains ARC-003/008/011/019/020/023; this does not declare the entire application free of SQL or implicit typing.

## Verification and release

Focused tests cover evidence denials and slow-storage/response lifecycle, exact error/header behavior, all five payment plans, closed/duplicate/mismatch guards, trigger selection and forced audit failure. AST guards keep database/transaction dependencies out of these HTTP controllers and Express out of selected domain components. Existing native multi-tenant, scanner/storage, every-plan payment and memory-stress/browser suites remain required runtime evidence.

No new migrations, dependencies, secrets or configuration. Preserve frozen migrations, data, local overrides and stashes. Run exact-commit full release plus required CI before merge. Author unit/type/build checks do not substitute for Docker/native/browser/evidence-stress execution. Hardened API startup remains Node-based without npm/npx.
