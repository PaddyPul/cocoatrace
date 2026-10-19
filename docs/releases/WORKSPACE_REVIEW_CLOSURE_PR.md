# PR title

fix: review offer and recall commitments and align workspace action status

## Outcome

Users review inventory/contract and recall consequences before committing changes. Failed writes stay visible inside the open review. Home and deal action labels use the same server-derived meaning, while goods payment, delivery and settlement stay distinct.

## Changes

- Review offer buyer, quantity, price and inventory commitment before contract creation; retain failed review and allow Cancel/Escape without a write.
- Review recall activation and recovery snapshot changes; preserve explanations, quantities and existing safety boundaries.
- Display certificate, custody and invitation failures inside their native dialogs.
- Align action status across home/deal, and apply scoped payment/transport presentation without inventing missing milestones.
- Extend browser regressions and pure presentation tests; record acceptance of the previous bundle.

## Validation

Author checks: code quality, workspace/browser types, frontend boundary tests, backlog/risk checks and production build/budget. Browser runtime and full exact-commit release must pass on the founder machine before merge. No backend or database migration change.

## Remaining work

Accepted completion remains156/343 (45.5%). The primary dashboard/deal/payment/shipment consistency work targets UX-007 closure after full release and merge, yielding157/343 (45.8%). UX-006 remains partial until the remaining publication/action inventory is reviewed. Hosted readiness and universal accessibility are separate gates. This change makes no new fee, payment, custody or recall authorization decision.
