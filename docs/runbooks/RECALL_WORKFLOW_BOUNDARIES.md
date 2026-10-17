# Recall workflow ownership

ARC-008 and RCL-010 candidate; runtime acceptance remains required.

| Owner | Responsibility |
| --- | --- |
| recall/lifecycle.ts | Bounded activation orchestration, recall boundary lock, scoped graph and atomic audit |
| recall/activationRepository.ts | Source lots, notice/affected rows, stock holds and listing withdrawal SQL |
| recall/notifications.ts | Email worker orchestration and delivery adapter |
| recall/notificationRepository.ts | Participant scope, durable outbox queue, leased claims and token-guarded completion |
| recall/response.ts | Acknowledgement, contact, recovery and resolution use cases |
| recall/responseRepository.ts | Typed response reads and transactional mutations |
| recall/policy.ts | Current manager and network authority decisions |

Activation still fails without complete bounded tracing. All activation stock holds, listing withdrawal, participants, queue and audit writes share one transaction. The initiating organization is acknowledged by issuance; recipients acknowledge their own response separately. SMTP submission is not inbox delivery. Claims commit before external submission; failed claims roll back and release the connection; completion requires the current lease token.

Recovery retains exact three-decimal accounting and current holding ownership. Resolution retains current management authority, proof and recipient/accounting checks; it retains holds on returned/destroyed stock and never republishes listings. Existing conditional hold release for fully accounted corrected/released inventory remains unchanged. Existing safety/reconciliation modules remain the source of stock protection.

No new roles, network grants, second approver, public data exposure, migration or external endpoint. Review [operation authority](../security/RECALL_OPERATION_AUTHORITY.md) before assigning permissions. Hosted load, independent security review and operational recall exercises remain separate backlog work.

Author checks cannot substitute for exact-commit Docker integration/browser and release acceptance. Existing recallSafety, recallResponse, recallResponsePages and recallRegisterPages suites remain required along with the new authority regression.
