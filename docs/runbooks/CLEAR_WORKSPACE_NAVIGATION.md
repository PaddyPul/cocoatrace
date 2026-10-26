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
