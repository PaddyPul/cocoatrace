# Outcome

Remove the remaining explicit-any escape hatches in production API code and protect legacy controllers/services with the same no-new-any enforcement as migrated feature modules. Invalid trust metadata cannot be silently reduced to an apparently valid subset; malformed optional narrative responses fall back to deterministic guidance.

# Changes

- Add concrete session, trace, trust and holding row contracts; infer recall-impact inputs from the existing validation schema.
- Make the database helper generic with unknown query parameters, type operation status rows and use complete query-result test fixtures.
- Normalize untrusted trust metadata field by field and accept only explicit narrative text from external JSON.
- Extend no-explicit-any lint enforcement across production API code, retaining frozen-migration exclusions and existing strict feature-test rules. Add CI-policy probes for controllers, services, middleware, trust and the database helper.
- Record founder acceptance of OPS-011:166/343 (48.4%). Type-safety items receive no closure credit before release acceptance.

# Validation

Author checks:1491 API unit tests passed, workspace/browser type checks passed, backlog tests passed and quality checks passed. Independent review found no material blocker in trust normalization, trace query typing or shared database contracts. Native Docker/browser execution remains required through the guarded handoff and full release.

# Remaining work

QLT-007 is a closure candidate after native/full release acceptance. ARC-020 remains partial: inherited framework/database row defaults and broader high-risk boundary typing are not eliminated merely by zero explicit-any annotations. Trace timestamp declarations retain their prior serialized-string convention while PostgreSQL can return Date objects; full DTO precision is follow-up. Hosted, legal/policy and representative device requirements remain separate. Sprint target remains268/343 (78.1%), with102 further full-task closures required after accepted OPS-011.
