# Oracle investor demo

Tracking: INV-001, INV-003, IDN-021, OPS-008, OPS-009. All remain IN PROGRESS until hosted evidence is recorded. See ADR 004. Synthetic demonstrations only; do not upload actual customer documents or use real payments.

## First deployment — Ubuntu SSH terminal

Prerequisites: reviewed release merged to main with green GitHub CI; /home/ubuntu/bettertrade is the clean checkout; Caddy already serves bettertrade-demo.duckdns.org; Docker is running; root-only /etc/bettertrade/smtp.env has passed Gmail authentication. Do not run the local base Compose or any seed/reset command on this VM.

```bash
(
  set -euo pipefail
  cd /home/ubuntu/bettertrade
  test -z "$(git status --porcelain --untracked-files=all)" || {
    echo 'Local changes exist. Stop and preserve them.'; exit 1;
  }
  git fetch origin main
  git checkout --detach origin/main
  echo "Candidate: $(git rev-parse HEAD)"
  test -f deploy/oracle-demo/compose.yml
  if sudo -n test -f /etc/bettertrade/demo.env; then
    echo 'Existing deployment secrets preserved.'
  else
    sudo -n python3 deploy/oracle-demo/configure.py
  fi
  sudo -n bash deploy/oracle-demo/deploy.sh first
)
```

Confirm GitHub CI for the printed main SHA before invoking the final deployment command. When prompted, choose a private administrator email and a unique 20–72 byte password stored in your password manager. Email can be the notification Gmail address if desired; application password must be independent of Gmail and its app password. No input characters appear for the password prompts. Never paste secrets into chat or commit them.

Initial ClamAV startup/signature acquisition can take several minutes. A scanner failure must block evidence admission; do not select the development scanner. On success, open https://bettertrade-demo.duckdns.org, sign in with the new administrator, and enroll a passkey in account security. Known local demo accounts do not exist. New buyers/suppliers complete onboarding once; the administrator onboarding is already complete.

## Hosted acceptance before inviting investors

- Confirm the persistent demo environment notice, Request access visibility and absence of shared quick login controls.
- With an email you control, request a supplier organization. Receive verification, verify it, approve as administrator with passkey assurance, receive the invitation and accept it. Repeat for a separate buyer organization with a separate controlled address.
- Confirm invitation links use the HTTPS demo hostname, display BetterTrade branding and identify the message as a demo. Check spam if necessary. SMTP authentication alone is not inbox-delivery evidence.
- Test password reset, team invitation/resend and expired/reused/revoked links. A failed send must retain recoverable work and must not claim inbox receipt.
- Rehearse synthetic supply → offer → terms → documents → payment evidence → fee administration → transport → acceptance. Check cross-organization isolation and independent buyer/supplier browser sessions. No real funds move.
- Restart containers without deleting volumes; verify identities, passkeys, documents and trade history survive. Record the release SHA, date and actual outcomes. A full local release does not establish these hosted results.

## Inspection and failure recovery

```bash
cd /home/ubuntu/bettertrade
sudo -n bash -c 'export BT_RELEASE_SHA="$(git -c safe.directory=/home/ubuntu/bettertrade rev-parse HEAD)"; docker compose --env-file /etc/bettertrade/demo.env -f deploy/oracle-demo/compose.yml ps'
sudo -n journalctl -u caddy -n 50 --no-pager
```

If deployment fails, share the failure stage and container status. Do not post environment files, rendered Compose configuration or raw logs containing user links. Do not rerun configure.py to rotate secrets, run seed/reset, remove volumes, or restore an old database over new records. Existing configuration is deliberately preserved. After a first-installation failure, the `first` command is retryable; the administrator marker prevents creating a second administrator after a successful bootstrap. If the process was interrupted between the bootstrap commit and its marker write, inspect the existing administrator before proceeding; never bypass the occupied-installation guard.

For subsequent manual updates, confirm exact main CI, fetch/check out accepted main, then run `sudo -n bash deploy/oracle-demo/deploy.sh update`. Database/evidence snapshots under /var/backups/bettertrade are taken before migrations while writers are stopped. Keep maintenance active after an incompatible migration. Restore matching database, evidence and secrets into an isolated recovery target and verify it before any cutover. Retain the prior image/release; never assume image-only rollback reverses schema changes. Backups consume the VM disk; inspect `sudo du -sh /var/backups/bettertrade` and `df -h /`. Move verified encrypted copies off the VM before planning retention deletion. No automatic deletion is included.

## Enable CI/CD only after hosted acceptance

Run in Ubuntu after the first rehearsal passes:

```bash
(
  set -euo pipefail
  cd /home/ubuntu/bettertrade
  sudo -n install -o root -g root -m 700 deploy/oracle-demo/update-from-ci.sh /usr/local/sbin/bettertrade-demo-update
  sudo -n install -o root -g root -m 644 deploy/oracle-demo/bettertrade-demo-update.service /etc/systemd/system/
  sudo -n install -o root -g root -m 644 deploy/oracle-demo/bettertrade-demo-update.timer /etc/systemd/system/
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable --now bettertrade-demo-update.timer
  sudo -n systemctl list-timers bettertrade-demo-update.timer --no-pager
)
```

The VM checks main CI every 15 minutes and deploys the exact current main SHA only after successful quality-gate. Builds happen natively on ARM64; no external registry account or GitHub SSH ingress is required. GitHub API rate limits/outage fail closed. Re-run the installation commands after reviewing future updater changes: the root-owned updater is not silently replaced by a new checkout.

Pause: `sudo -n touch /etc/bettertrade/pause-auto-deploy`. Resume: `sudo -n rm /etc/bettertrade/pause-auto-deploy`. Inspect: `sudo -n journalctl -u bettertrade-demo-update.service -n 60 --no-pager`. Disable: `sudo -n systemctl disable --now bettertrade-demo-update.timer`. Disabling the timer does not interrupt an already running deployment; check service status before manual work. Never run manual deployment concurrently with the updater.

## Remaining deployment work

IDN-021 real inbox acceptance; INV-001/003 hosted investor rehearsal; OPS-008 scanner/outage exercise; OPS-009 coordinated restore and immutable release rollback; ENV staging/production isolation, encrypted object storage and verified database TLS; provider spending/retention monitoring and off-VM encrypted backup. No backlog item is closed by installing this configuration alone.

## Focused browser failure diagnosis

If the release stops in contractPages or languageFoundation, retain the branch and use `npm run test:browser:docker -- contractPages.spec.ts languageFoundation.spec.ts`. Selection accepts existing suite filenames only; no selection still runs every test. This resets only the dedicated disposable browser-test project. A focused pass does not replace a full exact-candidate release. Failed contract/language tests retain bounded redacted heading/alert JSON, best-effort masked screenshots and credential-free source locations under browser-test-results/safe. A closed or unavailable browser still leaves a JSON capture marker. Share these safe files; do not share private traces, cookies, storage or raw email links. These diagnostics do not identify a root cause by themselves and do not authorize push or deployment.
