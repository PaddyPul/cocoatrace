# Public reviewed evidence pages

GET `/public/products/:slug/evidence/page` accepts `limit` (1–100, default 50), literal `search` (max 80 characters) and an opaque `cursor`. It returns `{items, count, hasMore, nextCursor}`. Count is the complete currently eligible evidence count for the published profile, independent of search or page. Cursor scope includes profile ID, batch ID and search. Publication is rechecked for every page; missing/draft/archived profiles return 404. Unknown parameters, repeated values and invalid cursors are rejected.

The existing GET `/public/products/:slug` now embeds only the first 50 evidence metadata rows plus additive `evidencePaging` metadata. Consumers must not treat `evidence.length` as the full count. Journey, custody/shipment and notice histories are unchanged and remain separate open bounded-read slices.

Public evidence requires approved review status, validated content and a clean malware scan. The latest non-future evidence review must be unexpired and reviewed, from an independent organization, with a matching reviewer account/organization. A newer revoked, expired or self review cannot fall through to an older approval. Same-time revocation wins. These checks apply identically to page items and full totals.

Responses expose only ID, type, filename, claim description, hash, review status and creation date. They do not expose storage keys, uploader identity, URLs, tokens or file bytes. Existing authenticated download authorization is unaffected. Both public routes retain the shared profile abuse limiter; page reads use the existing catalog repeatable-read transaction and SQL/read deadlines. Responses are `no-store`. No new migration or configuration.

The Proof tab searches and navigates reviewed metadata independently of recall warnings. Failure/malformed response clears proof rows and presents unknown totals plus retry, rather than an empty/safe assertion. Focus/visible polling refreshes proof eligibility. Profile read errors are labelled unavailable with retry instead of asserting every error is 404.

## Verification

Author: 618 unit assertions, quality checks, workspace/browser types and production builds. Added six PostgreSQL cases for 1,005 records, literal search, unpublished profiles, cursor scope, latest revocation, scan/review eligibility and invalid input; three browser cases for navigation, failure/retry and revoked proof with retained safety warnings. Native Docker/PostgreSQL/browser execution requires founder exact-commit release acceptance. No extra manual matrix.
