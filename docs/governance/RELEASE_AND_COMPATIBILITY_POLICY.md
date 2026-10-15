# Release and compatibility policy

Status: repository policy candidate for founder review and release acceptance. Tracks GOV-007 and GOV-010. This establishes conventions; it does not declare an existing production release or change runtime behavior.

## Release identity and evidence

Every candidate is identified by its full Git commit SHA. A branch, bundle filename, package version or mutable image tag is insufficient evidence. Run `npm run verify:release` on the candidate with no tracked changes; retain its commit-specific summary, required CI URL/result and PR review. Record the eventual merge SHA separately. A merge commit is a different revision: verify the merged artifact before deployment and never attribute an earlier summary to that SHA.

Use `bettertrade-vMAJOR.MINOR.PATCH-rc.N` for immutable reviewed release candidates and `bettertrade-vMAJOR.MINOR.PATCH` for an accepted release. These are the adopted naming forms, not tags created by this policy. Do not reuse or move published tags. A corrected candidate gets a new commit and candidate number. Before the first tag, the release owner chooses the initial product version explicitly and records it in the release notes; historical package values do not determine it.

The root/API manifests currently say `1.0.0` and the web manifest `2.0.0`. They are existing workspace metadata, not evidence of three marketed product releases or a unified product/API version. This policy does not reconcile them, rename packages or promise separate package publication. Any future manifest alignment needs its own reviewed change.

For every published candidate retain a release manifest with:

| Field | Required content |
| --- | --- |
| Identity | Product version label, full source SHA, candidate number, PR and merge SHA when known |
| Build | CI run URL, build timestamp, Node/runtime versions and artifact build provenance |
| Artifacts | Container registry digest for each deployed image; SHA-256 checksum for each distributed bundle/archive |
| Gates | Exact-source release summary and required CI result; distinguish local/founder reports from independently archived evidence |
| Deployment | Environment, deployment time, deployed image digests, configuration revision identifier with no secret values |
| Data | Migration identifiers, upgrade/backfill implications, backup prerequisite and tested compensation/recovery instructions |
| Compatibility | Added/changed/removed contracts, affected consumers, migration instructions and deprecation notices |
| Acceptance | Named release owner/reviewer, known limitations and unresolved blockers |

Generate checksums from final bytes, then publish them alongside the artifact; never edit an artifact after recording its checksum. Pin deployment to digests, not a moving `latest` label. Do not put secrets, real customer documents or token-bearing URLs in evidence. Keep application release records with the source/release archive and deployment runbook. A local pass is not evidence of hosted readiness.

## Semantic versioning and changelog

For the product version, increment PATCH for compatible corrections, MINOR for compatible capabilities and announced deprecations, and MAJOR for incompatible consumer behavior. Before 1.0, do not use a zero-major label as permission to break pilot workflows silently: the notice and migration requirements below still apply. An additive enum/status value is not automatically compatible when existing clients exhaustively match known values.

Maintain `CHANGELOG.md` in the same PR as a material change. Use an Unreleased section with Added, Changed, Fixed, Security, Deprecated and Removed only where relevant. Explain customer/operator impact, compatibility, migration/configuration and limits; link evidence/backlog records. At release acceptance, move the appropriate entries under the actual version and date and link the immutable manifest. Never invent versions, dates, fixes or deployment claims. Security entries may withhold exploit detail until mitigation is available, with a reviewed disclosure reference.

## API and customer workflow compatibility

The current API has no new version prefix introduced by this policy. Existing routes and responses remain the contract until a reviewed implementation changes them. Inventory direct browser clients, external integrations, saved links, jobs, exports, persisted statuses and in-flight trades before changing a field, endpoint, status or required customer step.

A deprecation proposal must name the owner, affected contracts/consumers, replacement, reason, announcement date, earliest removal date/version, migration guide, telemetry/verification, in-flight data handling and recovery plan. Publish the notice in the changelog and operator/customer release notes. Notify enrolled pilot participants through the agreed support channel and record delivery/acknowledgement; documentation alone is not evidence that a participant was informed. Do not send notices to scraped or unverified contacts.

Ordinary removals require at least 90 calendar days after notice and an explicitly announced incompatible version boundary. Use the later condition; do not remove merely because a date passed. No known active consumer may be left without a tested migration path. If usage cannot be measured, record that uncertainty and obtain the release owner's explicit risk decision rather than assuming zero use. Maintain the old behavior during the overlap unless a reviewed security exception applies.

| Change | Required migration behavior |
| --- | --- |
| Field rename/removal/type change | Add replacement first; support old readers/writers during overlap; define conflict precedence for dual input; test both; remove only after notice and migration acceptance |
| Endpoint replacement | Keep the existing authenticated/authorized route during overlap; introduce replacement explicitly; document error and pagination differences; do not redirect unsafe writes without a reviewed client contract |
| Status/enum change | Define transition mapping and persisted-data migration; test old/new client behavior and retries; render an unknown status as unavailable/unsupported with a refresh/support path, never as settled, safe, verified or action-authorized |
| Required workflow step | Explain changed responsibilities and deadlines; preserve or explicitly migrate in-flight agreements with participant acknowledgement; never rewrite accepted commercial terms silently |
| Error/envelope change | Treat status codes, machine codes, nullability and bounded-list behavior as contracts; distinguish unavailable data from empty history and document intentional incompatibility |

Do not map an unknown server state to the nearest successful state. Authorize every mutation server-side using current parties, permissions and workflow state; a fallback label or legacy client is never an authorization grant. Compatibility must not preserve cross-tenant disclosure, expired access, a revoked token, malicious content or prohibited writes.

Verification includes old and replacement requests, wrong-party access, stale clients, unknown status rendering, retries/idempotency, concurrent transitions and upgrade data as applicable. Add contract/native/browser tests where they exercise real behavior. Record the check results and remaining consumers in the deprecation notice before removal. Preserve immutable audit/history meanings; use forward migrations and explicit mappings rather than editing frozen migrations or historical accepted terms.

## Security emergency exception

A security owner and release owner may approve a shorter or immediate restriction when retaining compatibility would expose data, enable abuse or permit unsafe state transitions. Record the threat, scope, affected consumers, decision makers, effective time, mitigation, migration/support path and follow-up review in the release record. Notify affected participants promptly using a safe disclosure, without delaying urgent containment. Test the denial and legitimate replacement path. Do not restore vulnerable behavior as rollback; use a forward correction or safe service restriction. An emergency is not a blanket exemption for unrelated product changes.

## Release acceptance checklist

- [ ] Version label and immutable candidate/source/artifact identity agree.
- [ ] Changelog, migration/configuration notes and customer limitations describe actual behavior.
- [ ] Deprecations meet notice/removal conditions, or a scoped emergency decision is recorded.
- [ ] Exact-candidate release evidence and required CI are accepted; deployed artifact is verified separately.
- [ ] Release owner records review, deployment decision and recovery instructions.

GOV-007/GOV-010 policy publication is complete only after this policy is reviewed and merged. Actual first-version tagging, release manifests and any future deprecation execution are obligations when those events occur, not claims made by publishing this document.
