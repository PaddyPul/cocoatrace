# Incremental code-quality gates

Backlog: QLT-006, QLT-007 and ARC-028.

`npm run verify:release` and CI run quality and workspace type checks before the existing release checks. Install the committed dependencies with `npm ci`. Node must satisfy `^20.19.0 || ^22.13.0 || >=24`; CI uses Node 22.

- `npm run lint` checks API, web, browser tests and runners. Existing loose types and unused variables remain permitted outside the adopted strict modules.
- Payment and delivery modules reject explicit `any` and unused declarations. Prefix intentionally unused parameters with `_`. The delivery workflow now names contract, acceptance, discrepancy and response types; SQL and locking behavior are preserved.
- `npm run format:check` checks only paths registered in `scripts/quality-scope.mjs`. `npm run format:fix` formats that same scope. Expand it as modules are adopted, avoiding unrelated formatting churn.
- `npm run typecheck` checks API, web and browser tests.
- `npm run check:scripts` verifies supported Node/tsx entry points and npm workspace delegations. Obsolete compiled migration and seed aliases were removed; supported `db:migrate` and `db:seed` remain.
- Policy tests prove strict-module violations are rejected and frozen migrations remain excluded.

Frozen migrations and integration baselines must not be reformatted. Migration integrity remains a separate release gate. Formatting uses LF through Prettier and matching scoped Git attributes, with a Node runner that works on Windows without shell glob expansion. After applying the line-ending correction to an existing Windows checkout, run `npm run format:fix` once; it only rewrites the adopted scope. Do not globally renormalize migrations.

This is an incremental boundary, not a declaration that all architectural debt is solved. Broader strict typing, splitting remaining large pages/services, supported runtime upgrades and adoption of formatting by other modules remain backlog work. Keep behavior changes separate from large formatting passes.
