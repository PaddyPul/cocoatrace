# Third Sonar cleanup: dialogs, parsing, ordering and review dispositions

Start from accepted main d26a278d764d0070e48a614b2e700951084e1bb1 (merged PR #152). Apply this bundle on a new branch; capture the resulting candidate before installation and verification. Install with npm ci --ignore-scripts, run the complete release, and push only when the passed summary matches that exact candidate and HEAD/branch/worktree remain unchanged. Require GitHub CI and SonarCloud rescan before merge. No database migration or user-data reset is needed.

## Baseline reconciliation

All 211 IDs from the earlier user export remain in docs/quality/sonar-triage-2026-10-24.json. Prior batches targeted 89 source findings; this batch adds 76 (34 sorting/key-order sites, 29 interaction sites, four sourcing-parser patterns and nine dependency lifecycle-install sites). The total is 165 source corrections awaiting scan confirmation, plus 46 context-reviewed findings requiring explicit Sonar reviewer disposition. Source counts are not closure counts and may differ from the current merged-main scan. Nothing is dismissed, excluded or accepted automatically. Review the individual table and evidence in docs/security/SONAR_REVIEW_DISPOSITIONS_2026-10-24.md. Eight dependency risks still require separate package/version/advisory details.

## Required rehearsal

- Open farm/plot, batch, inventory/transfer, certificate, contract, shipment, access-decision and recall dialogs. Confirm the dialog has a name, focus stays inside with Tab/Shift+Tab, Escape honors busy/discard rules, and focus returns to its trigger after actual close.
- In certificate issuance, enter a crop scope, press Escape, choose Stay and keep editing, then confirm the draft remains. Cancel and explicitly discard; focus must return to Issue Certificate. These interactions must not send writes.
- Propose payment terms against a deliberate failed/conflicting response. The failure must remain visible inside the dialog, retain the commercial note and send exactly one write; it must not rely on a toast behind the modal.
- Verify renewal controls work independently from the supply-details link. Listing cards have a real keyboard-accessible link, without a clickable parent swallowing unrelated actions.
- Structure cocoyam, sweet potato, hibiscus and other arbitrary materials with decimals, kg/metric tonnes, origin, delivery and dates. Review unresolved/ambiguous fields before saving. Long invalid numbers must not become Infinity or an invented quantity.
- Confirm the full native release still passes migration/bootstrap, cursor/permission scope, audited mutations and lock/concurrency journeys. Explicit comparators retain ordinal UTF-16 ordering; do not change to localeCompare just to satisfy a rule. Saved-filter property validation uses key membership and remains order-independent.

## Operational changes

CI and Bash setup use locked npm ci --ignore-scripts. The author validated a clean install and builds/tests without lifecycle hooks; existing explicit Playwright installation remains required. macOS-specific optional watcher behavior is not certified here. Actual Docker builds, storage/scanner recovery and native Windows release remain mandatory before acceptance.

The legacy docker-compose.yml is a local demo. Its published PostgreSQL, API and web ports now bind 127.0.0.1, preserving localhost use while removing default LAN exposure. This does not alter the separate local rehearsal project or reset volumes. Restarting that legacy Compose project is needed to change existing container bindings, if you still use it. Staging and production reject the known development database password, including percent-encoding. Configure an appropriate deployment secret before any future hosted deployment; no new secret is created by this bundle.

Base shell translations now define each stable key once alongside both languages to preserve the unchanged initial JavaScript budget. All keys, text and order were compared exactly with the previous catalog; account/device preference keys remain unchanged.

The mobile navigation regression waits for the contracts search field before starting its keyboard round trip, so a pending lazy page cannot replace the menu midway. No timeout extension, whole-test retry, action replay or network-error suppression is added.

Use npm run demo:rehearsal:start for retained-data founder testing after release. Deployment, paid resources and broad data resets remain on hold.
