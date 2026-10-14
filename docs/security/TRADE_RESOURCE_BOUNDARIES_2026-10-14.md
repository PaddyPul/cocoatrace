# Trade resource boundaries — 2026-10-14

This slice hardens direct contract, payment-request and shipment reads. Each initial query is scoped to the current buyer or seller organization, including callers with wildcard permission. Missing and unrelated identifiers receive the same endpoint-specific 404 body. Route UUID validation follows authentication and named permission checks. The existing session no-store default applies.

Contract related documents, installments, delivery state and next action are evaluated through the same bounded repeatable-read executor. Payment installments and shipment milestones share their parent read snapshot. Contract success is sent only after snapshot completion. Linked detail arrays use LIMIT 1001 and reject more than 1000 with CATALOG_READ_LIMIT; no truncated success is returned. Existing catalog statement/total deadlines remain unchanged.

Payment mutations retain ordered transactional locks, buyer submission, seller verification, proof ownership and audit behavior. New native tests use wildcard-role parties and an unrelated organization to prove broad permission does not replace party authority for document presentation, security submission/confirmation, reminders and existing installment submission/confirmation controls. Denials leave payment/security/document state and relevant audit events unchanged. Existing concurrency tests remain.

Shipment writes retain all eleven supported Incoterm responsibility rules. FOB seller preparation/loading and buyer transport arrangement are distinct obligations; being a buyer or seller alone does not grant the other party's milestone rights. Existing native matrix tests exercise legitimate/wrong-party/outsider writes and exceptional-dispatch limits; new tests cover private direct reads and displayed FOB action permissions.

Evidence byte-download controls are unchanged: entity relationship, scan/review state and transport-document payment-release gates still apply. Existing payment/document workflow regressions remain the runtime gate. This slice does not claim a completed field-level document disclosure review, universal mutation UUID validation, deployed capacity, or hosted security acceptance.

Evidence: controllers/contractReadBoundary.test.ts, catalog/privatePayments.test.ts, transport/privateShipmentDetail.test.ts; paymentWorkflow.integration.test.ts, paymentPages.integration.test.ts and transportResponsibilities.integration.test.ts. See releases/TRADE_RESOURCE_BOUNDARIES_WINDOWS.md for validation and handoff.
