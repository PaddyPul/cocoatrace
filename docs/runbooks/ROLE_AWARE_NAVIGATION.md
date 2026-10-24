# Role-aware navigation and experience rehearsal

## What changed

The sidebar and workflow search now use one permission-filtered navigation model. Buyers see Find supply, Sourcing requests, Offers and My trades. Suppliers see My supply, Offers and My trades, with a prominent Publish supply action. Everyday records have their own expandable Records section; it opens automatically on a record page. They are no longer labelled administration. Goods payments, Transport and Platform fees sit in a collapsible Trade registers section. Team & access uses the existing `/pilot` workspace route rather than the platform organization register.

Notifications, Trace & recall and Help remain pinned below the scrolling menu. Account security, known pilot limitations and replaying onboarding remain available under Account & workspace help. The environment banner and content now share the viewport height so the desktop footer is not clipped. Mobile uses the existing modal drawer, keyboard containment and focus restoration.

Only authorized workspaces appear in the selector. A buyer-only or supplier-only account does not get a misleading opposite-role switch. Accounts authorized for both can choose either; platform wildcard users can also select Platform administration. Default selection respects a permitted saved choice, explicit Home mode, or an applicable onboarding goal; otherwise operators default to administration and customer accounts use their granted role. Switching workspace changes navigation and Home, not permissions or ownership.

Platform administration has a dedicated review Home, pending fee queue, access applications, fee verification, organizations, account controls, privileged access review, audit, operations and network overview. Fee verification opens the existing fee register filtered to pending reviews. An authorized operator can explicitly select a trading workspace for a persona journey.

## Preferences, counts and access boundaries

The shared account-specific preference is `bt_workspace_mode:<userId>`. Permitted legacy customer preferences under `ct_experience_mode:<userId>` remain readable; old keys and `ct_guided_fresh_start` are not deleted. The obsolete global sidebar mode key is no longer used. Mode changes are saved only after navigation succeeds, so choosing Stay in unsaved-change review does not switch the menu or discard a draft. If preference storage is unavailable, the choice remains usable in that browser session. Stored values are always checked against current grants.

Offer badges use the existing server summary: suppliers see offers awaiting their response; buyers see offers awaiting supplier response. Those are different responsibilities. Counts are displayed only after a valid response; missing, malformed or failed reads clear the badge rather than inventing zero or preserving a stale count. Counts refresh on focus and periodically while the document is visible. The shell owns the read once for the desktop and mobile menus. Notifications and other menus do not invent unsupported counters.

The new `/sourcing-requests` page uses the existing buyer-scoped, paginated `mine=true` API. It supports search, explicit loading/failure/retry and empty results, and links to the existing reviewed-brief and matching flows. A permission check runs before loading the register, and a wrong-owner response is refused. It introduces no new write endpoint or automatic business action. All existing resource, tenant, MFA, financial and safety checks remain server enforced; navigation visibility is not an authorization boundary.

English and French navigation labels stay aligned. Workspace-only copy is loaded with the lazy workspace code, preserving the existing initial JavaScript budget. The shared page-loading recovery message is shorter while retaining its manual reload action; it does not replay business actions.

## Verification and limitations

New browser coverage exercises buyer/supplier/admin menus, saved-request review and matching links, a dual-role choice, account isolation, denied and wrong-owner reads, badge failures, pending fee deep links, blocked preference storage, mobile navigation, and unsaved-change cancellation. Navigation policy tests cover invalid/revoked workspace choices, read-vs-write capabilities and translated labels. Existing brand/preference/cookie, keyboard, form retention, sourcing, fee and public safety suites remain enabled.

This is not universal UX-001/UX-002 closure, a physical-device accessibility certification or hosted acceptance. Exact-candidate full Windows release and required GitHub CI remain mandatory. No dependency update, migration, data reset or external service configuration is introduced by this slice.

## Founder rehearsal after applying the candidate

1. Run the full release for the captured candidate and keep its matching passing evidence. Use the PR body in `docs/releases/ROLE_AWARE_NAVIGATION_PR.md`.
2. Start or rebuild the local rehearsal with `npm run demo:rehearsal:start`, then open `http://localhost:14000`. Existing data is retained. Do not use the reset command for this update.
3. Sign in as a buyer. Confirm there is no supplier switch unless that account has supplier grants. Open Sourcing requests, create a cocoyam brief, reopen it and find matching supply. Confirm Offers and My trades are easy to find.
4. In the separate supplier session, open My supply, Inventory, Sources & plots and Documents & evidence. Publish a supply and review an offer. Check that the offer badge describes who is waiting for whom.
5. Complete a trade through agreed protection, platform fee submission, transport, automatic document submission, actual payment receipt confirmation, inspected goods acceptance and settlement. Use the deal room's next action and task tabs; open the separate trade registers when needed.
6. As platform admin, select Platform administration if a different authorized workspace was saved. Check the pending fee queue and Fee verification's pending filter. Independently verify the external receipt using the existing fresh-passkey flow.
7. Start an unsaved form, attempt a workspace change, choose Stay and verify the draft and original menu remain. Then leave explicitly when ready. Check Ctrl+K search and mobile drawer navigation, including Trace & recall and Help.
8. Sign out and use a different buyer/supplier account. Confirm the previous account's workspace choice and counts do not carry over. Record remaining issues against INV-003; user acceptance is still required before declaring the investor rehearsal complete.
