# Transport transition ownership and cookie-write coverage

## Domain and HTTP seams

Shipment HTTP handlers now translate requests and return the existing workflow status/body. They do not query PostgreSQL, manage transactions or decide milestone policy. transportWorkflow/model.ts defines schema-derived inputs and row/result types; policy.ts owns pure forward-transition and payment-exception decisions; repository.ts owns SQL; service.ts owns transactions, domain guards and orchestration. Existing delivery/workflow.ts continues to own buyer acceptance, discrepancy reporting, proposal and approval use cases outside HTTP.

This is a behavior-preserving extraction. Incoterm roles, recall-before-dispatch priority, exact currency/payment/security gates, active payment-issue holds, arrangement fields, origin prerequisites and DPU/DDP confirmations retain their existing order. ETA writes still share timing history. Delivery still activates installments and distribution reporting, invokes settlement readiness and writes its audit inside the same transaction. A later failure rolls the transaction back. No new dispatch exception or bypass is introduced.

Normalized source review found13 of14 repository SQL statements unchanged; the remaining statement expands the same existing dynamic delivered_at clause in its repository helper. Existing native trading/payment/transport/delivery/recall suites remain runtime acceptance evidence. AST regression guards prevent database/transaction imports and SQL in shipment HTTP adapters, Express dependencies in transport/delivery use cases, and persistence/network frameworks in the pure transport policy. These guards enforce selected seams, not universal clean architecture. Other controllers, workflows and error-envelope adoption remain ARC-003/004/006/008/011/019/023 work.

## Registered cookie-write boundary

The real-app matrix enumerates all97 current POST/PUT/PATCH/DELETE registrations, checks equality with the runtime Express stack and executes8 disallowed-origin/header combinations at each entry point. Dummy cookies/tokens never authenticate; database query/connect probes prove rejection happens before state processing. All776 rejection requests must return403 ORIGIN_NOT_PERMITTED. Configured-origin invalid credentials and canonical Bearer/no-origin smoke checks preserve the intended machine-client distinction.

The matrix is discovered by the normal API unit gate, so adding a registered write adds its cases automatically. Existing middleware edge-case, real PostgreSQL cookie-session and browser sign-out regressions remain required. A green matrix proves entry-boundary enforcement, not valid credentials, every resource/field authorization combination or hosted HTTPS/proxy/cookie configuration. See security/COOKIE_WRITE_ROUTE_MATRIX.md. Host/forwarded headers cannot redefine configured trusted origin. No production origin policy is changed here.

## Release

No new migrations, dependencies, configuration or secrets. Preserve frozen migrations, databases, local overrides and stashes. Run the guarded exact-commit full release and required CI before merge. Existing native/browser journeys must validate the refactor; author policy/unit/type/architecture checks do not replace their execution. Hardened API startup remains Node-based and has no npm/npx.
