# Changelog

Material customer/operator changes are recorded here using the [release and compatibility policy](docs/governance/RELEASE_AND_COMPATIBILITY_POLICY.md). The full Git SHA and immutable artifact manifest identify a release; workspace package versions do not establish product release history.

## Unreleased

### Added

- Buyer withdrawal of pending offers with serialized terminal decisions and atomic audit (TRD-010).
- Seller rejection explanations with party-visible immutable history (TRD-011).
- Explicit external negotiation guidance and versioned customer pilot limitations (TRD-012, GOV-009).

- Release naming, semantic versioning, changelog and immutable artifact evidence conventions (GOV-007), together with API field/status/workflow deprecation, consumer migration and security-emergency review requirements (GOV-010). See the [policy](docs/governance/RELEASE_AND_COMPATIBILITY_POLICY.md).

### Compatibility and acceptance

- This inaugural changelog includes the candidate offer workflow and policies. Seller rejection now requires a reason (1–1,000 trimmed characters); older clients submitting an empty body receive a controlled 400 and must use the updated client. This is an explicit pre-pilot request-contract tightening, not an announced stable public API removal. Buyer withdrawal adds a route using the existing cancelled terminal state. No version tag or schema migration is created. Earlier merged capabilities remain documented in [release evidence](docs/RELEASE_EVIDENCE.md) and individual [release handoffs](docs/releases/); they are not retroactively assigned fabricated versions here.
- Current candidate: the full SHA containing this entry, as recorded by its commit-specific release summary and PR. Publication/release acceptance is pending; append the actual version/date and immutable artifact manifest when a product release is explicitly approved.
