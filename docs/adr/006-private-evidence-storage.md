# ADR 006 — Private quarantined evidence with authorized retrieval

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review accepted on 2026-10-15 with the pilot-integrity release. This status does not assert hosted deployment or independent security acceptance.

## Context

Trade proof can contain personal and commercial data, hostile content or misleading file metadata. A storage key or uploaded object alone must not establish safe, releasable evidence.

## Decision

Use the evidence storage adapter with private objects and quarantine/validation state. Validate file type/size and malware state; keep pending, missing or unsafe evidence unavailable. Serve authorized attachment downloads through current entity/party and payment-release policy rather than public static uploads. Bound storage operations and transfer admission; cleanup failures become durable recoverable work. Public evidence pages expose only their explicit eligible metadata projection. Local test storage does not prove hosted bucket encryption/public-access settings.

## Alternatives and rationale

Public bucket URLs simplify delivery but bypass revocation and contract release policy. Trusting filename or browser MIME type skips content validation. Scanner-only checks omit current stored-object availability and authorization. The private adapter adds storage latency and failure states that the product must report clearly.

## Consequences, validation and change control

A scanner/storage outage cannot make unsafe proof available or masquerade as an empty register. Hosted per-environment private buckets, encryption, access policy and restore proof remain prerequisites, not completed infrastructure. Replacing providers requires compatibility tests and preserved keys/object integrity; rollback must retain private access and quarantine state.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [api/src/services/evidenceStorage.ts](../../api/src/services/evidenceStorage.ts)
- [api/src/services/evidenceUploadService.ts](../../api/src/services/evidenceUploadService.ts)
- [api/src/services/evidenceAvailability.ts](../../api/src/services/evidenceAvailability.ts)
- [api/src/modules/payments/documentPolicy.ts](../../api/src/modules/payments/documentPolicy.ts)
- [api/test/integration/evidenceAvailability.integration.test.ts](../../api/test/integration/evidenceAvailability.integration.test.ts)
- [api/test/integration/evidenceTransferBudgets.integration.test.ts](../../api/test/integration/evidenceTransferBudgets.integration.test.ts)
