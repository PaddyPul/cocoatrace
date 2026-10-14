# Paired source-resource boundary review — 14 October 2026

Backlog: SEC-006, QLT-002, ARC-011; CORE-tenant. Engineering candidate only; native release and hosted acceptance are separate.

## Defined response classes

| Endpoint class | Authorized | Valid ordinary permissions, unrelated existing ID | Absent ID | Malformed ID after entry guards |
| --- | --- | --- | --- | --- |
| GET /farms/:id | Existing relationship or explicit farm.read.all | 404 Farm not found | Same 404 body | 400 |
| GET /farms/:id/plots/page and /summary | Same farm relationship/network policy | 404 Farm not found | Same 404 body/code | 400 |
| GET /batches/:id | Existing batch relationship or explicit batch.read.all | 404 Batch not found | Same 404 body | 400 |
| GET /certificates/:id | Existing certificate relationship or explicit certificate.read.all | 404 Certificate not found | Same 404 body | 400 |
| GET /holdings/:id | Current holder organization | 404 Holding not found | Same 404 body | 400 |

Missing/invalid credentials remain 401; absent route permissions remain 403 before ID validation. This does not grant a new network holding bypass. Certificate issuer/subject, cooperative, certifier and legitimate trade relationships are preserved, not replaced with organization equality. The new paired fixtures are unrelated organizations, so they do not claim every relationship-specific field projection has been accepted.

## Data and architecture

privateResources.ts contains four detail query builders. Controllers pass one bounded repeatable-read executor for relationship checks, metadata, collections and batch trust. Denied source details stop after narrow policy checks; holding scope is in its SQL predicate. An authorized read is coherent as of its snapshot. A concurrently reassigned holding is invisible to subsequent former-holder requests; an already started authorized snapshot can finish consistently. This is not instant cancellation of requests authorized before a suspension/ownership change.

Existing two-second statement and five-second read limits are reused; no deadline or result bound is increased. Collections keep their paged/legacy contracts. This is not a hosted latency/capacity claim. Frozen migrations, relationship permissions, write transactions, inventory quantities and outbox identity are not changed.

Session authentication establishes Cache-Control:no-store before credential/permission handling so authenticated data and private denial responses are not reused by HTTP caches. The 178 credential-boundary tests and 155 native missing-permission cases now check that header; paired positive/foreign/malformed source reads check it too. The public/token/capability surface retains its separate policy; this is not a claim about browser page memory, localStorage or every client-side cache.

## Automated evidence

- 21 unit cases for pre-hydration refusal, preserved authorized/network reads, holder-only queries, the shared trust executor, plot nondisclosure and UUID schema behavior.
- 34 native cases: both organizations' six direct/plot positive-foreign-absent cases; four collection/search/full-total checks for each; role union, explicit network access, malformed input after entry guards, live role removal, user/organization suspension, session revocation, snapshot consistency during reassignment, and no business mutation audit from the read matrix.
- Existing multiTenantApi, certificatePages and sourceDetailCollections foreign-read assertions are updated only for these classes. Evidence/provenance/profile and write response policies remain separately tracked.

No new paid provider, real email, schema, credential or role is configured by implementation. Tests create only disposable fixtures. Source/evidence pointers identify code and suites, not executed native proof; see the Windows handoff for actual results.

## Remaining work

Complete paired trade/payment/fee/shipment/evidence/profile/provenance and administrative action coverage, relationship-specific returned-field projections, role unions and revocation interactions, and each remaining resource-existence convention. Full universal QLT-002/SEC-006 and controller/repository separation ARC-011 remain partial. Hosted security, independent review, real inbox/incident ownership, recovery and capacity remain separate gates. No full-item percentage credit is taken from this candidate.
