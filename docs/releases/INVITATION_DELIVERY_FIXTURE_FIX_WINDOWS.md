# Invitation delivery fixture correction v2

The original native release passed 83 suites/877 cases, but the new suite assumed a seeded exporter role and skipped its 21 cases after setup failed. The first correction supplied exporter; the founder's focused rerun passed 20/21, exposing a second dependency on supplier_admin in first-admin approval.

Confirmed cause: globalSetup applies migrations, then truncates all business tables, including roles introduced by migrations. The earlier assurance that migration 017 guaranteed supplier_admin in the test database was incorrect. The v2 fixture explicitly provides both recipient roles. Supplier-admin permissions come from the existing bounded team policy. Existing roles/permissions are preserved; only fixture-created role assignments and roles are cleaned up. Issuer authority, all 21 scenarios, production code and migrations are unchanged. The injected SMTP/key error logs belong to passing negative tests, not a request to change deployment secrets.

Download bettertrade-invitation-fixture-v2-fix.bundle directly to Downloads. Apply only its tip on feat/durable-invitation-delivery-v1, after the first correction. Do not import earlier bundles again, alter migration data, regenerate the delivery key or reset volumes.

Capture the new committed candidate before verification. Run the focused suite first:

```powershell
npm run test:integration:docker -- invitationDelivery.integration.test.ts
```

If it passes, run the entire npm run verify:release. Push only with a passing release-test-results/summary.json matching the captured commit, unchanged HEAD/branch and clean tracked tree. Full guarded PowerShell instructions are supplied in chat. If focused verification fails, stop and send the output; do not push or merge.

Author checks: strict standalone compilation, existing bounded-role policy tests and code-quality checks pass. Native/Docker execution is still pending; 20/21 is not a full pass. The main PR description retains the exact requested format and records both failed native attempts honestly. After the corrected full release, record its new SHA/date and required CI evidence before merging. Backlog completion remains unchanged; no P0 reclassification or test bypass.
