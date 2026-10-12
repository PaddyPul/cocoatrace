# Access review and pilot feedback read boundaries

Access application reads remain platform wildcard only. Organization-admin permission is not platform access. Feedback reads require organization.admin or wildcard: ordinary organization administrators receive only their organization; wildcard administrators retain network scope. Feedback submission remains a separate authenticated action.

GET /access-applications/page and /pilot-feedback/page use max-100 keyset pages, literal server search and authority/filter-bound cursors. Page count is the full status/rating-filtered authorized count, independent of search; UUID keyset order is stable ID order, not a chronological claim. Their /summary endpoints report full authorized totals independent of search/page. Access status filters cover pending_email_verification, pending_review, approved and rejected; feedback rating filters cover 1–5. Unavailable summaries remain unknown while authorized page rows remain usable.

Legacy array endpoints return complete results up to 1,000 authorized records and explicitly reject overflow before expensive hydration. Shared repeatable-read/deadline controls apply; responses are no-store. Raw verification or invitation tokens/hashes, user credentials and unrelated user contacts are excluded from list projections. Access application administrative identity fields remain visible only to authorized platform reviewers.

Approval/rejection and resend behavior use existing authoritative mutation routes; the UI refreshes current reads after decisions. Email verification alone is not organizational legitimacy. Feedback is user-reported experience, not trade evidence or certification.

Run exact-candidate verify:release, including real PostgreSQL scope/paging/filter tests, existing identity approval flows and new browser retry/malformed-response checks. No migration or database reset. Hosted capacity and file concurrency remain separate acceptance work.

Feedback review is available to wildcard platform administrators and accounts explicitly granted organization.admin; ordinary buyer_admin/supplier_admin roles are not implicitly elevated. Expired-application retention, dedicated feedback-review grants, authenticated feedback submission budgets and chronological queue ordering are follow-up policy/operations work, separate from these read boundaries.
