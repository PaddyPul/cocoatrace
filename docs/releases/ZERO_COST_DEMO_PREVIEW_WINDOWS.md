# Zero-cost demo preview: full Windows instructions

This bundle creates a supervised synthetic demo on your existing PC. It uses a separate database, private evidence volume and real malware scanner. It does not expose or reset your normal localhost:3000 workspace. Your PC must stay awake and online while sharing. This is a temporary preview, not live staging or production.

You confirmed the previous staging branch was tested, merged and pulled. Download `cocoatrace-zero-cost-demo-preview.bundle` to Downloads. Run the commands in PowerShell, one block at a time; stop if a command fails.

## 1. Synchronize main and check your files

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git status
```

Tracked files should be clean. Keep untracked local Compose override files; do not add them to this branch. Do not reset or remove your data.

## 2. Import the new bundle on a new feature branch

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-zero-cost-demo-preview.bundle" "HEAD:refs/remotes/bundle/zero-cost-demo-preview"
git switch -c feat/zero-cost-demo-preview
git cherry-pick bundle/zero-cost-demo-preview
git status
git log -2 --oneline
```

Apply only the newest commit. Do not merge the bundle's full history. If this branch already exists or a conflict appears, stop and send the output rather than force/reset.

## 3. Run the automated release tests

Start Docker Desktop, then:

```powershell
npm ci
npm run verify:release
```

Wait for **Release checks: passed**. This includes builds, API tests, database regression tests, browser trade/identity/recall journeys and database restore checks. No long manual regression checklist is required.

```powershell
Get-Content "release-test-results\summary.json"
```

Do not push/merge if a required gate fails. The new preview container job also runs on GitHub; native preview/scanner startup still needs the next step on your PC.

## 4. Start the separate local preview

```powershell
npm run demo:preview:start
```

The first start builds images and downloads scanner signatures; it can take several minutes. Wait for:

`PASS: local preview readiness, frontend and synthetic buyer/supplier identity checks`

Then open:

```powershell
Start-Process "http://127.0.0.1:14000"
```

Check the page shows the supervised-demo notice. Use **New buyer** or **New supplier**. The initially empty operational workspace is deliberate: no old farms, inventory, contracts or evidence are inherited. You can create disposable demo records and the next startup retains them.

Synthetic credentials if needed:

| Role | Email | Password |
| --- | --- | --- |
| Buyer | newbuyer@cocoatrace.io | Password123! |
| Supplier | newsupplier@cocoatrace.io | Password123! |

These are shared demo accounts. All invited visitors use the same synthetic workspace and can see changes made by others. Do not use real customer records, personal data, real payments or sensitive documents. Application email is simulated; no SMTP or AI-provider configuration is required.

## 5. Create an email-restricted temporary HTTPS link

Replace the example addresses with your real email and, optionally, intended visitor emails. Do not leave `example.com` addresses in the command.

```powershell
npm run demo:preview:share -- --emails "your-email@example.com,visitor-email@example.com"
```

Only 1–10 exact email addresses are permitted. You do not need a Cloudflare account, purchased domain or router settings. The command:

1. Checks that the downloaded tunnel image supports Cloudflare's documented email gate. It never removes this restriction as a fallback.
2. Starts the tunnel and updates CocoaTrace's public links and secure-cookie setting.
3. Tests that an unauthenticated request does not expose the app.
4. Prints the temporary HTTPS URL and stays running in this terminal.

If the image lacks `--allowed-mail` or the access-gate probe fails, sharing stops. Your local preview remains available. Send the exact error; do not try an unrestricted tunnel command.

Open the printed URL in a private/incognito window, use an allowed email address, and enter the one-time code Cloudflare sends. Then use the demo Buyer/Supplier buttons. The PIN email is sent by Cloudflare, not CocoaTrace.

The only targeted external check: an allowed email can get through; an unlisted email cannot. This verifies the provider integration that cannot be reproduced with local mock tests. All long application journeys are already automated.

Keep the share terminal open and your PC awake. The runner stops sharing after two hours while it is running. Closing or crashing the terminal abruptly can leave a detached tunnel container running; use the stop command below if that happens. A new share session creates a new URL.

## 6. Stop sharing or stop the entire preview

Press **Ctrl+C** in the sharing terminal to stop its tunnel. To stop the entire preview from another PowerShell window:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
npm run demo:preview:stop
npm run demo:preview:status
```

This retains synthetic records and uploaded disposable test evidence. It does not stop or delete your ordinary application project. Do not use `docker compose down -v` or delete `.demo-preview`; its generated secrets match the retained database.

To restart locally later:

```powershell
npm run demo:preview:start
```

To rerun the local automated smoke check:

```powershell
npm run demo:preview:check
```

## 7. Push the feature branch

After release checks and local preview start pass:

```powershell
git status
git push -u origin feat/zero-cost-demo-preview
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/zero-cost-demo-preview?expand=1"
```

Suggested PR title: `Add zero-cost supervised synthetic preview`.

Suggested description: `Adds isolated synthetic demo startup, real malware scanning, private evidence storage, automated buyer/supplier smoke checks, restricted temporary HTTPS sharing, a visible demo notice, and a native CI preview startup job. No live staging infrastructure is provisioned. Validation: npm run verify:release and local demo:preview:start passed; record whether real Cloudflare email access was also verified.` Only state those checks passed after running them.

Do not commit `.demo-preview`, generated reports, secrets or local Compose overrides. The bundle already contains the intended committed code and documentation.

## 8. Merge on GitHub

Wait for all required checks, including **synthetic-preview**, to pass. Review the PR, click **Merge pull request**, then **Confirm merge**. Do not bypass failed checks. The real email-gate result remains a separate provider check; BST-001 stays in progress until that is confirmed.

## 9. Pull merged main

Stop the preview before switching branches if it is currently shared:

```powershell
npm run demo:preview:stop
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
```

Expected: main is up to date with origin/main and tracked files clean. You may retain local untracked overrides. If fast-forward fails, stop and send the output.

To demonstrate from merged main:

```powershell
npm run demo:preview:start
npm run demo:preview:share -- --emails "your-email@example.com,visitor-email@example.com"
```

## Verification before handoff

173 API unit tests, nine runner checks, API/web builds, browser TypeScript checks, migration integrity and YAML validation passed. PostgreSQL WASM tests verified compatibility of synthetic fixture loading with forward migrations and functional buyer/supplier logins, and the existing logical schema regression. Native Docker startup and real Cloudflare email authentication are not claimed from the authoring environment.

Persistent live staging, managed backups and production hosting remain separate backlog work. The temporary tunnel has no uptime guarantee. Multi-currency and multi-language remain on the roadmap.
