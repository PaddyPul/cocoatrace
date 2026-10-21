# Invitation delivery fixture correction

The first native release run passed 83 suites/877 cases, but invitationDelivery.integration.test.ts assumed the unseeded database already contained the legacy exporter role. beforeAll failed and all 21 delivery scenarios were skipped; those skips are not passing coverage.

Correction: create the required recipient role only if absent, preserve pre-existing role permissions, report a clear missing-fixture error if unavailable, remove only fixture-owned assignments/role after deleting the suite's invitations, and always close the pool. Ordinary issuer authority and every delivery assertion are unchanged. The other role dependency (supplier_admin for first-admin approval) is explicitly introduced by migration 017; it is not a demo seed assumption.

No production code, schema, dependencies, secret, migration digest, accepted backlog count or authorization gate changes. This is a test-only correction to the existing feature branch. The main PR description retains the required template and now records the failed native setup honestly.

Download bettertrade-invitation-fixture-fix.bundle directly to Downloads. Do not import the original durable-delivery bundle again, create a new feature branch, or reset volumes. Stay on feat/durable-invitation-delivery-v1. Apply only the correction tip, capture the resulting candidate before verification, run the focused native suite, then run the entire release. Push only after a matching passing release summary and clean tracked tree. Full PowerShell instructions are supplied in chat.

Focused command (the runner accepts one filename, no --suite flag):

```powershell
npm run test:integration:docker -- invitationDelivery.integration.test.ts
```

Author: standalone strict compilation and code-quality checks passed. Native/Docker execution is still pending; the prior 877 passing cases do not establish that these corrected 21 cases pass. If the focused run fails, stop and send the failure rather than running the full release or pushing.

After full success, update the existing PR using docs/releases/DURABLE_INVITATION_DELIVERY_V1_PR.md and record the new passing SHA/date and CI. Required PR checkboxes for native/browser acceptance remain unchecked until their runs actually pass. No new P0 classification or completion credit.
