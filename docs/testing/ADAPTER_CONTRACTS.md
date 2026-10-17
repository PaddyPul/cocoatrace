# Current external adapter contracts

QLT-014 covers the implemented storage, email and malware-scanner ports. The inventory below is checked by `api/src/testing/adapterContracts.test.ts` in the API unit suite. The check discovers concrete production classes implementing external ports with the `Storage`, `Scanner`, `Sender`, `Provider` or `Adapter` suffix, rejects inventory drift and checks the referenced contract suites and this inventory. New external ports must use this naming convention and an explicit `implements` declaration. Function-only adapters or adapters avoiding that convention require code review; this check is not a universal detector of arbitrary integrations.

| Port and source                                                       | Concrete implementations                | Maintained behavioral contract suite                                               |
| --------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| EvidenceStorage — `api/src/services/evidenceStorage.ts`               | LocalEvidenceStorage, S3EvidenceStorage | `api/src/services/evidenceStorage.test.ts`                                         |
| EvidenceMalwareScanner — `api/src/services/evidenceMalwareScanner.ts` | DevelopmentScanner, ClamAvScanner       | `api/src/services/evidenceMalwareScanner.test.ts`                                  |
| EmailSender — `api/src/services/emailSender.ts`                       | DevelopmentEmailSender, SmtpEmailSender | `api/src/services/emailSender.test.ts`, `api/src/testing/adapterContracts.test.ts` |

## Checked invariants and evidence boundaries

- Local storage: opaque environment-scoped keys, traversal rejection, write/move/read/delete, absent and empty object distinctions, metadata-first size rejection, growth after stat bounded during reading, read deadline and legacy-file allocation guard. Local rename and S3 copy/delete are different operations; neither is claimed to be a cross-provider atomic transaction.
- S3-compatible storage: HEAD without reading bodies, valid finite length metadata, streamed known/unknown length and overflow cancellation, missing-object semantics, response-length consistency, opaque provider error bodies, and finite request/body deadlines. Unit tests control HTTP responses; they do not certify AWS, every S3-compatible deployment, IAM, encryption policy or availability.
- Development scanner: ordinary content and harmless EICAR detection only. This is not a production antivirus assurance claim.
- ClamAV: exact INSTREAM framing/content, backpressure, PING readiness, infection signature retention, finite absolute deadlines including drip-fed responses and blocked writes, bounded response size, and configured retry attempts on fresh connections. TCP fixtures exercise the wire contract, not a real malware engine.
- Development email: explicit suppressed outcome, delivery-off selection, recipient/header validation, and logs excluding recipient addresses, message bodies and identity URL tokens.
- SMTP: relay authentication and acceptance, dot stuffing, required STARTTLS refusal before credentials/content, malformed-reply refusal, recipient rejection before DATA, status-only provider rejection errors, and a healthcheck that authenticates without delivering mail. `sent` means relay acceptance; it is not an inbox delivery receipt or exactly-once guarantee. Outbox retry/idempotency belongs to the owning domain workflow, not the transport adapter.
- Identity message helpers bind reset/invitation/verification links to the configured public origin. Deployment TLS/configuration requirements remain covered by environment validation, not inferred from a successful local relay test.

Native disposable-storage and scanner evidence remains in `api/test/integration/multiTenantApi.integration.test.ts`, `api/test/integration/evidenceTransferBudgets.integration.test.ts`, `api/test/integration/evidenceAvailability.integration.test.ts` and `api/test/integration/evidenceExists.integration.test.ts`. Captured identity email journeys remain in `e2e/identity.spec.ts`. Those runtime checks require Docker/browser execution; passing unit contracts alone does not satisfy the release gate.

## Future provider admission rule

There is currently no logistics-provider adapter or live provider contract certification. Before introducing any logistics, payment rail or other external provider adapter:

1. Define the typed port and register every concrete implementation in the checked inventory. Use an explicit `implements` declaration and a port suffix covered by the discovery check; extend the check when another convention is necessary.
2. Add executable success and failure contracts for the actual protocol: authentication, tenant/resource scope, malformed/oversized responses, finite time and allocation bounds, cancellation, retries and idempotency, safe errors and redaction. Document semantics that differ between implementations rather than hiding them behind false parity.
3. Supply a disposable native/sandbox integration and provider-specific configuration/healthcheck tests before enabling deployment. Explicitly record any unavailable sandbox or unsupported operation; do not label mocked traffic as verified provider integration.
4. Update this matrix, inventory and release evidence together. Retain business authorization and atomic audit/outbox ownership in the domain workflow. A provider adapter must not grant trade permissions or redefine Incoterm responsibilities.

The current-adapter contract task can close with this enforced extension rule. Logistics onboarding, verified company selection, fulfillment services and actual future-provider acceptance tests remain separate open product/integration work.
