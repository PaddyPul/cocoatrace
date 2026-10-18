# Unsaved change protection coverage — 2026-10-18

Candidate technical coverage; browser/full release acceptance remains pending. Uses React Router's navigation blocker through the data-router shell. The guard registers only draft presence, stores no contents and sends no draft. Browser reload/tab-close warnings are best effort and use the browser's own wording. Session loss and login/passkey/security remediation bypass the guard.

| Entry workflow | Dirty state | Successful save | Remaining boundary |
| --- | --- | --- | --- |
| Conventional inventory | Exact form snapshot compared with initial values | Clear before redirect to supply selection | No draft persistence/recovery after a crash |
| Farm and plot entry | Open editor has entered fields beyond defaults | Saved editor closes/resets before later navigation | Closing an editor inside the same page is not a route transition |
| Harvest entry | Open editor has entered fields beyond defaults | Saved editor closes/resets | Same-page editor close remains follow-up |
| Workspace onboarding | Goal/pilot settings differ from saved baseline | Update baseline after successful progress/finish | Internal wizard step controls already save progress |
| Sourcing create/edit | Actual brief/specification edits or structured result | Clear before matching/home redirect | Reverting every field does not automatically reset the edit marker |
| Supply publishing | Actual commercial field or holding selection edit; inventory search excluded | Clear before listing redirect | Field-reversion reset is follow-up |
| Evidence contribution | Explanation/file draft differs from last successful upload | Clear after successful upload; saved explanation retained | File-picker local selection is not persisted; record changes remain explicit |

Existing server/refusal and asynchronous refresh behavior must continue retaining entered state. A failed save never clears the navigation guard. The review dialog offers Stay and keep editing or Leave and discard changes; Escape stays. Browser back and route changes use the same blocker. If the review chunk is unavailable, a stay-only fallback retains the current page and draft. Changing a query parameter is navigation; changing only the hash is not blocked.

## Open adoption

UX-011 remains partial. Long reviewed forms in delivery/payment/security/fee/refund, recall investigation/recovery, operations recovery, access decisions and team/security management are not registered by this slice. Their existing draft-retention/confirmation behavior is useful but does not establish route-leave coverage. Support, organization/certificate/product administration, marketplace offer composition and same-page modal close warnings also require inventory/adoption before claiming whole-app completion. Public login/reset/invitation forms intentionally do not trap security navigation. Mobile browser unload prompts and responsive/keyboard acceptance require the release environment.
