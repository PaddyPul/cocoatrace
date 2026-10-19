# Workspace state audit and recovery

Baseline164/343, after founder acceptance of first resilience batch. This second candidate checks every54 page module against68 source/trade/admin/shared evidence entries. `npm run check:workspace-states` rejects a new unreviewed page or a dangling evidence path; it does not execute those tests or claim all branch permutations are covered.

Inventories:

- source-route-resilience.json: source/public/catalog/details/compatibility pages and recorded uncertainty.
- trade-route-resilience.json: commercial, financial, delivery/transport panels and remaining validation/action-error gaps.
- admin-auth-route-resilience.json: identity/admin/team/support/operations and secret-preservation boundaries.
- shared-route-resilience.json: public service observation and its explicit limitations.

Read failures, malformed responses and permission denials must not become empty/safe/completed states. GET retry is explicit and must not replay a business write. Known denied contexts clear stale action state. Same-record transient refresh keeps drafts where supported, blocks stale action where required and labels missing assurance Unknown. Unsubmitted credentials never persist. Optional device preference writes cannot invalidate a completed server write.

Current concrete fixes cover listing/provenance/shortlist freshness, farm totals, malformed public reads, agreement/delivery/cancellation/fee/deal/marketplace/workspace retry, passkey/invitation/admin reads and global onboarding unknown state. Existing server authorization, critical audit transactions and fee/safety gates remain unchanged.

Inventories deliberately retain individual DTO, toast-only action, offline/device and runtime evidence gaps. UX003/004/005/PRD011 remain partial until the whole requested behavior is demonstrated. Do not turn54 reviewed page pointers into54 completed backlog tasks. OPS016 public current status targets separate closure after acceptance. OPS011 private process metrics exclude direct transaction-client query instrumentation and hosted monitoring.

The35-task sprint target remains199/343. This is a multi-bundle target, not a completed count. New actual native/backend boundary regression is in operationsWorkers.integration.test.ts; browser coverage requires the founder environment. Author API unit tests, types and source-policy tests are separate from that execution.
