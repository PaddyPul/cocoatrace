# Clear workspace navigation — 2026-10-25

The daily menu stays above the supporting record list on desktop. Suppliers have four primary destinations; buyers have five; platform administrators have four. The create action is visually distinct from the active page. One visible workspace label replaces the repeated section heading. Multi-workspace users retain their account-scoped selector; single-workspace users do not receive a selector.

Buyer/supplier supporting pages are combined under Records. Admin supporting pages are under Administration. Opening one of those pages expands its section. Expanded records and account help flow naturally within the sidebar at every screen size. There is no separate Records scroll area or sticky summary. When content exceeds the available height, the entire sidebar scrolls together, including daily links and utilities. Account options expand inline rather than in a separate scrolling popup.

## Local retained-data acceptance

After the exact-candidate release, CI and merge, pull main and run `npm run demo:rehearsal:start`. Open http://localhost:14000. Use the existing buyer/supplier/admin sign-in options. Do not reset the demo database for this navigation test.

- Supplier: one Supplier workspace label, Publish supply, Home, My supply, Offers and My trades are visible before opening Records. Records includes permitted inventory/source/document and trade registers. The separate Trade registers heading is gone.
- Buyer: Home, Sourcing requests, Find supply, Offers and My trades remain visible. Supporting records are under Records.
- Admin: Overview, Access requests, Fee verification and Operations are visible. Organizations, account controls, privileged review, audit and network overview remain available under Administration. Existing queue pages retain their data; no unsupported aggregate badge is added.
- Open Records/Administration and scroll through it. The whole sidebar should scroll together if needed, with no inner scrollbar around Records. Collapse the section using its summary.
- Open a record directly or reload it. The supporting section should open and identify the active destination.
- Reduce the window height or use a mobile drawer. Scroll to account controls, verify Help and Trace & recall are reachable, then close with Escape and check focus returns to the trigger.
- For users allowed both buyer and supplier modes, switch workspaces and reload. Test a dirty sourcing form: cancelling the leave prompt must preserve the draft and current workspace.
- Check French navigation and workflow search. This is navigation translation coverage, not a claim that every product page is translated.

## Verification and rollback

The original navigation revision had 33 production-build mocked-API Chromium cases. The natural-scroll follow-up is delivered for local review before release; see its PR description for current author verification. Full native release and founder manual acceptance remain external gates. No migrations, secrets, production deployments or business mutations are introduced. Rollback is a Git revert of the navigation change; no data reset or compensation is needed.

## Navigation coverage follow-up — 2026-10-26

Supporting pages use Records, Organization and Account & help disclosures. Empty groups are hidden. The whole sidebar remains the only scrolling container. Active destinations expand their group, including after a direct URL or reload.

- Buyer organization admin: daily sourcing links, source provenance through supply listings and trades, without Sources & plots or Harvest batches in the buyer menu, Team & access under Organization, and Account & help.
- Supplier organization admin: existing daily supply links, permitted source/inventory/trade records, Team & access under Organization, and Account & help.
- Ordinary buyer/supplier members: records follow actual read permissions; Team & access is hidden unless the server grants member.invite or member.manage. Viewer accounts without trading capabilities use the Records workspace and can browse supply when listing.read is granted.
- Platform admin: four existing daily destinations; Document review under Administration; operational registers under Records; Team & access under Organization; Account & help.

The legacy seeded importer account lacks team-management permissions. This change does not promote that account or ordinary members. To review buyer team management, use an approved buyer organization's administrator account. Verify /api/me permissions locally if an expected admin entry is missing; do not share credentials or tokens.

The route register in docs/quality/navigation-route-coverage.json covers 59 registered paths: 34 menu paths across permitted workspaces, 13 contextual paths, nine public/token paths, two redirects and one demo-only path. Detail pages are reached through their corresponding records/trades. Upload is reached from Documents & evidence, inventory creation from Publish supply, comparison from Find supply, and passkeys from Account & security. Demo-only setup is available through workflow search only in demo mode. Token routes intentionally require issued links. A route register is a discoverability inventory, not proof that every role may open every route or that a database-backed journey passed.

Before release, review all five personas above, French labels, expanded groups on short screens and mobile, workflow search, direct record URLs and dirty-form navigation. Full release and push instructions follow founder acceptance.

Buyer menu correction — 2026-10-26: source and harvest registers are supplier/administrative navigation. Buyer read permissions and contextual source detail routes remain unchanged. Workflow search uses the same filtered menu.
