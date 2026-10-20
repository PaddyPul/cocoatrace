# Outcome

Observe database queries made through acquired transaction clients as well as the shared helper. Previously the query histogram omitted much of the business transaction path. Expand the sprint register to103 unresolved targets (30% of343), without awarding implementation-only completion credit.

# Changes

- Instrument each physical application-pool connection once; preserve promise identity and callback results/errors. Remove helper-level duplicate observation.
- Count successful/failed queries and connection reuse without retaining SQL, parameters, rows or identity labels. Acquisition remains a separate observation; streaming/submittable queries and independently created pools remain excluded.
- Document the changed histogram coverage and retain private/no-store authorization boundaries.
- Add unit coverage and a native PostgreSQL regression for transaction errors, callbacks, helper calls and reuse.
- Link the103-candidate sprint plan from the README. Accepted count remains165/343 (48.1%); target268/343 (78.1%). OPS-011 stays partial pending release acceptance.

# Validation

See the Windows handoff for the focused native test and mandatory exact-commit release. Author-side validation passed:1487 API unit tests, workspace/browser type checks, native suite TypeScript compilation, quality checks and103-candidate uniqueness/count validation. Native Docker execution and hosted monitoring were not run author-side.

# Remaining work

Accept the native regression and full release before closing OPS-011. The103-task register is a target, not an achieved sprint. Hosted collection, retention, alerts and independent operational acceptance remain separate gates.
