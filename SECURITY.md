# Security reporting

BetterTrade is maintained in the `PaddyPul/cocoatrace` repository. The repository owner is the initial security-report intake owner; an operational private channel and backup owner must be verified before pilot access is opened.

## Report privately

Use this repository's **Security → Report a vulnerability** action if GitHub presents it. Check that the destination belongs to `PaddyPul/cocoatrace` before submitting. Private vulnerability reporting has **not been verified enabled** by this change. If the action is absent, a working private reporting contact is not yet established; do not put vulnerability details, credentials or customer records in a public issue, discussion or pull request. Repository maintainers must enable and test private reporting or publish another verified private contact before inviting pilot organizations.

Do not use a guessed email address or send commercial data to an unverified account. GitHub account ownership alone does not prove a private inbox is monitored.

## What to include

- Affected release or commit, endpoint or screen, and expected versus observed behavior.
- Minimal reproduction using accounts and data you control; indicate any tenant or role boundary involved.
- Impact and a redacted example. Keep passwords, session tokens, private evidence files and personal or commercial records out of the report.
- Whether exploitation is ongoing, and a safe way to contact you inside the private report.

Stop testing if it could affect another organization, availability, funds, inventory or real shipments. Do not access unrelated records to prove impact, run destructive or load tests without agreement, or publish an exploit while a report is being coordinated.

## Response and supported releases

The pilot support target is the currently deployed approved release. Reports against other commits are welcome but do not imply maintained support for historical branches. The maintainer should acknowledge reports within two business days and provide an initial triage update within five business days. These are operational targets, not guaranteed response times or a paid support commitment. No bug bounty or payment is offered by this policy.

Maintainers coordinate remediation and disclosure privately, notify affected operators when appropriate, and publish a redacted advisory after a fix or agreed mitigation is available. Do not include a reporter's identity without their consent.

See [the security report runbook](docs/runbooks/SECURITY_REPORTS.md) for intake activation, triage and closure evidence. This policy does not establish that an inbox is enabled, staffed or tested.
