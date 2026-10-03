# Showtime from an iPhone with Codex Cloud

Use the GitHub repository `philh0001/Showtime` and start product tasks from `main`. The live site is `https://showtimetracker.show`; the API is `https://api.showtimetracker.show`. Codex Cloud uses GitHub files, not this desktop's checkout, ignored files, credentials, or chat history. The old `rollback-stable-baseline` checkout and its uncommitted work are separate from the live `main` branch. See the [official Codex Cloud environment guide](https://learn.chatgpt.com/docs/environments/cloud-environments) for current setup controls.

## One-time setup in iPhone Safari

1. Before pushing or merging, inspect **both** `showtime-web` and `showtime-api` in Cloudflare Dashboard → Workers & Pages → Worker → Settings → Builds. Confirm whether a Git repository is connected, its production branch, and whether preview builds are enabled. The repository has no GitHub Actions deployment workflow, but dashboard-triggered [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) cannot be ruled out from Git alone. A connected production branch can deploy on push; a preview branch may create a Cloudflare preview. Keep routine work on a feature branch and review the deployment effect before publishing it.
2. Open [ChatGPT](https://chatgpt.com) in Safari, sign in, then choose **Work in → Cloud → Select environment → Create environment**. If the setup controls are hidden on the narrow page, use Safari's **Request Desktop Website**. Connect GitHub if prompted and select only `philh0001/Showtime`. Use a private environment. Creation and publication are done on the web; the iPhone app can use the published environment.
3. Ask Codex to use **Node.js 22** and these install commands from the repository root (three independent lockfiles):

   ```sh
   npm --prefix app ci
   npm --prefix production/api ci
   npm --prefix production/web ci
   ```

   Have its start instructions say: work from the repository root, read `AGENTS.md`, run `npm run check`, and do not deploy without an explicit release instruction. Check the setup report and test results, save the setup, then select **Publish**. Wait for **Environment published**. If an audit or test fails, record the failure and fix it in a task; a published environment alone does not prove the checks passed.
4. Allow the **Package managers** internet preset for npm installs and audits. No credentials or extra domains are needed for the offline tests, typecheck, lint, or web export. Add `api.themoviedb.org` only for live local/UAT TMDB requests; add `showtimetracker.show` and `api.showtimetracker.show` for remote smoke checks; allow `github.com` for Git commands if required. Add `api.cloudflare.com` only when preparing an explicitly authorised Cloudflare operation. Test each added destination in a new cloud task.

## Configuration

| Name | Purpose and where it belongs |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | Optional for the non-deploying gate; required for `npm run local` and `npm run local:tmdb`. In Codex Cloud, add as a **network secret** for `api.themoviedb.org`; the local Node adapter sends it in an HTTPS Bearer header. On desktop, the ignored `local-uat/.env.local` still works. It must never enter `app/` or an `EXPO_PUBLIC_*` variable. Production uses a separate Cloudflare Worker secret of the same name. |
| `EXPO_PUBLIC_SEARCH_API_URL` | Optional public URL for local client testing. The production export script sets the canonical API URL itself; no token belongs here. |
| `SHOWTIME_API_URL`, `SHOWTIME_FRONTEND_ORIGIN` | Public URLs for the optional `npm --prefix production/web run smoke` command against a deliberately selected deployed API. `SHOWTIME_SMOKE_CANARY` is an optional harmless test marker. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Required only if a cloud task is explicitly asked to run Wrangler against the Cloudflare account. Create a least-privilege token in Cloudflare, supply it through the Codex Cloud **Personal vault** as a network secret restricted to `api.cloudflare.com`, and set the account ID as a direct variable if Wrangler needs it. Verify account identity with `wrangler whoami` before any deployment. Desktop Wrangler login is not copied into the cloud. |
| `RESEND_API_KEY` | Existing **production API Worker secret** for account email; it is not needed in Codex Cloud to install, build, or test. Do not copy it into source or the client. |
| `ALLOWED_ORIGINS`, `EMAIL_FROM`, `APP_NAME`, `APP_URL`, `RESEND_VERIFICATION_TEMPLATE_ID` | Public production API Worker variables already declared in `production/api/wrangler.jsonc`. Preserve their values and bindings; `SHOWTIME_DB` and rate limiters are Cloudflare bindings, not cloud task variables. |

Use **Settings → Codex Cloud → Personal vault** in Safari to enter any needed secret. Never paste token values into a task prompt, GitHub file, PR, log, or screenshot. For ordinary cloud coding, leave deployment credentials unset.

## Daily phone loop

1. In the **ChatGPT iPhone app**, open **Codex**, choose the published Showtime cloud environment, and choose `main` as the starting branch for a new task (or the intended feature branch when continuing it). State the goal and ask for checks and a diff. If that branch changes a lockfile, have Codex rerun the three `npm ci` commands before checking it; republish the environment when its reusable baseline changes. Reopen the **same task** for follow-ups so its working files and context continue; a new task gets separate files. Queue extra work, steer a running task only to correct its direction.
2. Review the changed-file summary, diff, and test output in the app. Ask for corrections there. Have Codex commit the reviewed change on a feature branch and open a PR to `main`; confirm the branch or PR appears on GitHub, then use Safari to inspect its checks and Cloudflare preview link **if one exists**. Neither a cloud build nor a PR means the live site changed.
3. For preproduction checks, run `npm run check`; the local/UAT Node adapter can exercise TMDB requests only when its optional secret and network access are configured. This repository has **no hosted UAT URL, UAT D1 database, or guaranteed phone-accessible preview**. Codex Cloud currently has no browser automation; use iPhone Safari for any accessible Cloudflare preview after confirming Workers Builds preview settings and its isolation. After an authorised production deployment succeeds, check Home, Search, details, Watchlist, Profile, account/sync, reload, and narrow layouts in iPhone Safari on the live URL.

## Deployment and return to desktop

`production/web` exports `app/` and deploys `showtime-web`; `production/api` deploys `showtime-api` with TMDB, D1, rate limits, and account email. The existing [runbook](CLOUDFLARE-RUNBOOK.md) requires `npm run production:check` before an explicit `npm run production:deploy:web` or `npm run production:deploy:api`. Rebuild the web export before a web deploy. API schema migrations are separate, reviewed D1 operations. A Wrangler dry run, PR, push, or merge is not proof that production changed; verify deployed Worker versions and public routes after a release.

When back in VS Code, use a fresh clone/worktree if the old rollback checkout is still dirty. Fetch GitHub, check out the cloud task's feature branch, and pull it; after a PR is merged, fetch and pull `main`. Do not reset or overwrite the old checkout to retrieve cloud work.
