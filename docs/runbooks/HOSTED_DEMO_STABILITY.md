# Hosted demo stability and isolated recovery

Tracking: INV-001, ENV-005/013/017, OPS-002/009, IDN-021. Synthetic investor demo only. No new cloud resources, paid services, customer-data admission, staging or production environment are introduced.

## Accepted evidence and remaining acceptance

Founder-provided Oracle terminal output on 2026-10-26 records merged release ab7dcfbf40429b17f996ff9f5805e4ded86c1387, a unique administrator and healthy PostgreSQL, ClamAV and API. The web health check failed on localhost; an IPv4 override made it healthy and the HTTPS readiness probe passed. The Git index was root:0600 and was repaired narrowly. Founder confirms Request access and Gmail delivery, with spam placement unresolved. These are founder-reported observations, not a claim of continuous availability since that date.

This candidate makes the web probe use 127.0.0.1:3000/api/health/ready, sets GIT_OPTIONAL_LOCKS=0, fails if Git inspection fails, repairs only a root-owned regular index to the .git directory owner's ownership, and refuses an update older than or divergent from the active release. Shared locking in the root-owned mode-700 /etc/bettertrade directory serializes deployment, snapshots and recovery verification; symlink locks are rejected. No account/password/passkey, SMTP credential or existing application volume is reset.

Administrator input is collected and validated before the bootstrap container starts. Hidden terminal control characters are rejected explicitly rather than silently stripped; valid Unicode passwords are preserved. The server reports which input field failed without printing its value. An occupied installation still refuses bootstrap. The credential collector accepts no path argument and refuses terminal/pipe output; the deployment redirects its JSON into a root-owned mode-600 file inside its private temporary directory, using shell noclobber. Temporary credentials are removed on exit. The legacy generated /etc/bettertrade/admin-bootstrap.json is preserved: save the password privately, test normal login/passkey/recovery, then remove this specific legacy file only when it is no longer needed. Never post it in chat or logs.

Native full release, green exact-main CI (including hosted-demo-recovery), actual Oracle update/restart, a non-empty-evidence recovery report and off-VM disaster recovery remain separate acceptance. Readiness is not representative performance evidence. Core backlog completion remains based on whole-item criteria.

## Update the current Oracle demo after merging

Run in Ubuntu SSH after the Windows release passes, the PR merges and main quality-gate succeeds. This performs an update, never a first installation. The deployment makes its own CI check and creates a pre-migration consistent snapshot while application writers are stopped.

```bash
(
  set -euo pipefail
  cd /home/ubuntu/bettertrade
  sudo -n touch /etc/bettertrade/pause-auto-deploy
  if sudo -n systemctl is-active --quiet bettertrade-demo-update.service; then
    echo 'An updater is running. Wait for it to finish, then rerun this block.'
    exit 1
  fi
  # Narrow repair for the previously observed root-owned index only.
  if [[ $(stat -c %U .git/index) == root ]]; then
    sudo -n chown ubuntu:ubuntu .git/index
  fi
  export GIT_OPTIONAL_LOCKS=0
  bt_status="$(git status --porcelain --untracked-files=all)"
  if [[ -n "$bt_status" ]]; then
    echo 'Pending changes exist. Stop and preserve them.'
    exit 1
  fi
  git fetch origin main
  git checkout --detach origin/main
  echo "Candidate: $(git rev-parse HEAD)"
  sudo -n bash deploy/oracle-demo/deploy.sh update
  curl --fail --silent --show-error --max-time 20 \
    https://bettertrade-demo.duckdns.org/api/health/live
  echo
  git status --short
)
```

Expect a maintenance window after builds finish. On success the base Compose profile supplies the permanent IPv4 check. The historical /etc/bettertrade/web-health-override.yml can remain privately as a recovery reference; update/deploy no longer requires it. Do not include it as an extra Compose file for normal updates. Do not rerun configure.py or first/bootstrap for this existing installation. Confirm the old administrator, passkey and an existing buyer/supplier trade still work.

If an update fails, maintenance stays active. Keep the exact failure stage and redacted container status; do not delete volumes or restore a previous database blindly. Snapshot metadata is written last, so a directory without recovery.json is not a complete recovery checkpoint. Image-only rollback is not a database rollback. A live restore requires a separately reviewed coordinated cutover after verification; recovery.py intentionally offers no live-restore operation.

## Take a current consistent snapshot

Upload at least one scan-clean synthetic document through the application first. A rehearsal with zero evidence files does not demonstrate non-empty document recovery. This command briefly enters maintenance, stops API/web writers, dumps the database and archives actual private evidence bytes, then starts the existing containers and resumes HTTPS. It never rebuilds, migrates or recreates the installation.

```bash
cd /home/ubuntu/bettertrade
sudo -n bash deploy/oracle-demo/backup.sh
```

Snapshots are root-only directories under /var/backups/bettertrade. They include the database, evidence archive, Caddy configuration, demo/SMTP secrets and a recovery.json with file hashes, source release, exact locally available image IDs, public-table row hashes, schema hash, sequence state and evidence-byte hashes. They contain secrets and private data: never upload the snapshot itself to chat or GitHub. No automatic retention deletion is implemented. Check `df -h /` and `sudo -n du -sh /var/backups/bettertrade`; at least 8 GiB free is required before maintenance/restore, but large datasets may need more space.

## Verify the newest current-release manual snapshot

Run in Ubuntu. The rehearsal runs while the demo can remain online. It holds the maintenance lock and uses a separate PostgreSQL container (512 MiB/one CPU limit), separate temporary database/evidence volumes, no network, no published ports and no application startup or SMTP. It uses the exact cached source images; it never pulls new images. It compares restored schema, all public table rows, sequence values and every archived evidence file's bytes. It does not prove external IdP recovery, account login, business-journey correctness, recovery of a lost VM or an agreed RTO.

```bash
(
  set -euo pipefail
  cd /home/ubuntu/bettertrade
  bt_snapshot="$(sudo -n python3 - <<'PY'
import json
from pathlib import Path
root = Path('/var/backups/bettertrade')
active = Path('/etc/bettertrade/active-release').read_text().strip()
valid = []
for manifest in root.glob('*-snapshot-*/recovery.json'):
    if manifest.is_symlink():
        continue
    if json.loads(manifest.read_text()).get('release') == active:
        valid.append(manifest)
if not valid:
    raise SystemExit('No complete manual snapshot for the active release. Run backup.sh first.')
print(max(valid, key=lambda item: item.stat().st_mtime).parent)
PY
  )"
  sudo -n python3 -B deploy/oracle-demo/recovery.py verify "$bt_snapshot"
)
```

The printed report is under /var/backups/bettertrade/rehearsals. A full byte rehearsal needs status=passed, databaseVerified=true, evidenceVerified=true, nonEmptyEvidenceVerified=true and cleanupComplete=true. A passed report with evidenceFiles=0 is only an empty-volume test. The report contains counts/stages and no credentials, email addresses, document contents or raw database rows. You may share that report for acceptance. Do not share recovery.json from the snapshot, environment files or dumps.

Cleanup only addresses uniquely generated, matching-label bt-restore-* resources. A failed cleanup is a failed rehearsal and reports the isolated names for inspection. Never remove a volume based only on a prefix, and never run `docker compose down --volumes` against the live project. Source volumes are only read by the verifier and are never restored into or deleted.

## CI coverage and acceptance boundaries

check:quality runs Node Git/CI guards and, on Linux, Bash syntax and Python archive/input admission tests. Those Linux-only checks are explicitly skipped on native Windows and must run in CI. The hosted-demo-recovery CI job separately restores a disposable database containing users, a related trade and sequence state plus actual non-empty evidence bytes. It verifies integrity failure, failed-pg_restore cleanup and preservation of the source database. CI report filenames are fixed positive.json, negative.json and summary.json. Reports stay mode 600 in a mode-700 directory; a separate workflow step transfers ownership to the runner for upload, without making them public. Only redacted rehearsal JSON is uploaded; dumps and secrets never enter CI artifacts. This does not constitute a restore on the founder's Oracle VM.

## Optional updater after acceptance

Keep the pause file until the update, restart and hosted recovery tests pass. If using pull-based CD, install the new root-owned updater script using the installation commands in ORACLE_INVESTOR_DEMO.md, then remove /etc/bettertrade/pause-auto-deploy to resume. The updater reads common.sh from the accepted checkout, fetches/checks out as the repository owner and deploys only the exact current main SHA with successful full quality-gate. The lock covers its checkout and deployment. Do not run a manual checkout while an updater is active.

Next work remains IDN-021/BRD-005 email inbox placement and full lifecycle acceptance; INV-002/003 tester journey; OPS-002/009 off-VM encrypted backup and coordinated recovery; PER-004 hosted capacity; and staging/production isolation/TLS/object-storage controls. No paid infrastructure or provider account is silently provisioned.

## Source image identity on containerd stores

The 2026-11-02 update reached snapshot creation but the archive helper could not start: the API container's Image configuration digest was not a runnable image reference, while the original release tag remained cached under an image-index ID. This is not proof that the original release image was deleted. The previous demo was restarted and HTTPS readiness passed; the failed partial snapshot is preserved and must not be used for restore.

Recovery now resolves a locally inspectable image ID, then creates (but never starts) a networkless, labeled probe from that pinned ID. When available, source and probe must have the same valid SHA-256 platform-manifest digest, manifest media type and complete platform metadata. Backend-dependent container Image/config/index IDs need not be equal. Only when both descriptors are absent does the legacy guard require equal container Image IDs; one-sided, malformed or mismatched descriptors fail closed. A moved tag, absent original image or mismatched configuration fails closed; no registry pull or newer-image substitution is allowed. Only the probe and its automatically created anonymous volumes are removed after checking its label. The snapshot records runnable pinned IDs and the original container configuration digests separately. Existing complete snapshots remain supported, but their image IDs must still be locally available.

Deploy and backup run source-image and read-only archive preflight before enabling maintenance or stopping writers. The public preflight command also takes the shared lock and does not change the app:

```bash
cd /home/ubuntu/bettertrade
sudo -n python3 -B deploy/oracle-demo/recovery.py preflight
```

After merging the image-identity correction and successful main CI, use the existing update block above. Do not manually edit the failed snapshot, fabricate recovery.json or delete its files. Keep automatic deployment paused until the real update and non-empty-evidence rehearsal pass. The image-resolution regressions cover index/config differences, moved tags, missing images and probe-label cleanup; the Docker CI fixture and actual Oracle acceptance are separate evidence.

The subsequent Oracle diagnostic confirmed that the source and the unstarted probe selected the exact same linux/arm64 manifest (545207db...), even though their Image IDs differed (1be6154c... versus 639fddb7...). The initial equality-only correction therefore rejected a valid source image. The manifest correction includes that exact observed case as an end-to-end resolver regression, plus different-manifest, architecture/variant, invalid-digest and missing-descriptor rejection. The guarded preflight stopped before maintenance and left the demo online. These recorded diagnostics do not prove an actual successful snapshot or restore; acceptance remains pending.
