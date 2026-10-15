# Protected deployment diagnostics

`GET /operations/deployment` requires a live session with wildcard platform permission and the existing privileged-account passkey assurance. Responses, including authentication denials, are not cacheable. The endpoint never returns environment variables, connection strings, storage names, paths, email addresses or credentials. It accepts no query parameters.

The response contains exactly `schemaVersion`, `environment`, `metadataStatus`, `gitSha`, `builtAt` and `provenance`. Environment is the validated runtime APP_ENV. Git SHA and build time come from the image build asset `api/dist/build-metadata.json`; build time is captured when building, not when the API starts. The artifact is validated strictly before projection. Missing or malformed artifacts produce explicit null identifiers and `metadataStatus: incomplete` rather than claiming a known release. An unstamped development build may have its actual build time with a null SHA.

## Producing the image

Supply `BUILD_GIT_SHA` as a full lowercase 40-character commit SHA to the API Docker build. For example, capture `git rev-parse HEAD` from the clean reviewed release candidate and use `docker build --build-arg BUILD_GIT_SHA=<full-sha> -f api/Dockerfile .`. Do not pass a short SHA, branch name, or the developer workstation's unrelated checkout. The build fails on malformed supplied values. Omitting the argument leaves the commit unknown, which is suitable for local experiments but is not adequate deployment evidence.

For a non-Docker compiled deployment run `node api/scripts/stamp-build-metadata.mjs` after compilation with BUILD_GIT_SHA supplied by the release job, then deploy both the compiled API and the generated asset together. The runtime has no dependency on Git or npm and does not infer image identity from mutable runtime metadata.

## Release evidence

An assured platform operator reads the protected endpoint from the deployed origin and records its full SHA, build time, environment and provenance beside the reviewed candidate. Require `metadataStatus: complete`, the expected SHA, the intended staging/production environment and a plausible build timestamp from the build job before accepting the deployment. A healthy database or successful local test is not proof that a hosted image runs that candidate. This implementation does not attest image signing, prove a clean builder, or replace the actual hosted verification step.
