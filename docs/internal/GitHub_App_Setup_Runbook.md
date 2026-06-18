# GitHub App Setup Runbook (Internal)

Operator runbook for creating and wiring the PipeWatch GitHub App on **staging** and **production**. Customer-facing CE instructions live in the marketing docs (`/docs/github-app-setup/*`); this document is the source of truth for MDG Labs hosted environments.

**Related specs:** `PipeWatch_MVP_PRD.md` §4.3–§4.4, §12.1, §12.6, §20, §23 · Decision #1, #4, #9, #33

---

## Summary

| Item | Value |
|---|---|
| Integration type | **GitHub App** (not OAuth App, not PAT) |
| MVP visibility | **Private** (Decision #9 — no public marketplace listing pre-GA) |
| Production slug (target) | `pipewatch` |
| Apps per environment | **One GitHub App per environment** — each app has a single webhook URL |
| Secret storage | Phase → GitHub Actions (`staging` / `production`) → Fly via `sync-secrets.yml` |
| Runtime env prefix | `GITHUB_*` on Fly/Workers; `GH_*` in Phase/GHA |

---

## Why separate apps for staging and production

GitHub Apps expose **one webhook URL** per app. Staging and production APIs run on different hostnames, so each environment needs its own app (and its own credential set in the matching Phase environment).

| Environment | API hostname | Webhook URL |
|---|---|---|
| Staging | `https://staging-api.pipewatch.app` | `https://staging-api.pipewatch.app/webhooks/github` |
| Production | `https://api.pipewatch.app` | `https://api.pipewatch.app/webhooks/github` |

Use distinct app names and slugs (e.g. `PipeWatch Staging` / `pipewatch-staging` and `PipeWatch` / `pipewatch`).

---

## URL matrix (staging & production)

All **auth and install callbacks** are on the **API host**, not the dashboard (`APP_URL`). The dashboard links users to `{API_URL}/auth/github` for sign-in.

### Staging

| GitHub App field | URL |
|---|---|
| **Homepage URL** | `https://staging.pipewatch.app` |
| **Callback URL** (user OAuth) | `https://staging-api.pipewatch.app/auth/github/callback` |
| **Setup URL** (post-install redirect) | `https://staging-api.pipewatch.app/onboarding/github-callback` |
| **Webhook URL** | `https://staging-api.pipewatch.app/webhooks/github` |
| **Install URL** (for testing) | `https://github.com/apps/{GH_APP_SLUG}/installations/new` |

Dashboard: `https://staging-cloud.pipewatch.app` · Marketing: `https://staging.pipewatch.app`

### Production

| GitHub App field | URL |
|---|---|
| **Homepage URL** | `https://pipewatch.app` |
| **Callback URL** (user OAuth) | `https://api.pipewatch.app/auth/github/callback` |
| **Setup URL** (post-install redirect) | `https://api.pipewatch.app/onboarding/github-callback` |
| **Webhook URL** | `https://api.pipewatch.app/webhooks/github` |
| **Install URL** | `https://github.com/apps/pipewatch/installations/new` |

Dashboard: `https://cloud.pipewatch.app` · Marketing: `https://pipewatch.app`

### API routes reference

| Route | Method | Purpose |
|---|---|---|
| `/auth/github` | GET | Start user sign-in OAuth (scopes: `read:user user:email`) |
| `/auth/github/callback` | GET | OAuth code exchange → JWT + refresh cookies |
| `/onboarding/github-callback` | GET | GitHub App install callback (`?installation_id=`) — requires auth cookie on API host |
| `/webhooks/github` | POST | Signed webhook receiver (`X-Hub-Signature-256`) |

Paths are **not** prefixed with `/api/v1` for these system routes.

---

## Step 1 — Create the GitHub App

**Location:** GitHub → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**

Repeat for **staging** and **production** (two separate apps).

### Basic information

| Field | Staging | Production |
|---|---|---|
| **GitHub App name** | e.g. `PipeWatch Staging` | e.g. `PipeWatch` |
| **Description** | Staging PipeWatch Cloud integration | Production PipeWatch Cloud integration |
| **Homepage URL** | `https://staging.pipewatch.app` | `https://pipewatch.app` |
| **Callback URL** | `https://staging-api.pipewatch.app/auth/github/callback` | `https://api.pipewatch.app/auth/github/callback` |
| **Expire user authorization tokens** | ✅ Enabled (recommended) | ✅ Enabled |
| **Request user authorization (OAuth) during installation** | ✅ Enabled | ✅ Enabled |
| **Setup URL** | `https://staging-api.pipewatch.app/onboarding/github-callback` | `https://api.pipewatch.app/onboarding/github-callback` |
| **Setup on update** | ✅ Enabled (redirect after install/update) | ✅ Enabled |
| **Webhook** | ✅ Active | ✅ Active |
| **Webhook URL** | See URL matrix above | See URL matrix above |
| **Webhook secret** | Generate a strong random string (store as `GH_WEBHOOK_SECRET`) | Same |

### Where can this GitHub App be installed?

| Phase | Recommendation |
|---|---|
| Pre-GA / private MVP | **Only on this account** — limit to `mdg-labs` org |
| Post-GA public app | **Any account** |

MVP ships as a **private** app (Decision #9). Do not publish to the GitHub Marketplace until explicitly planned.

---

## Step 2 — Permissions

Request the minimum scopes below. Excess permissions slow org security review and are unused in MVP.

### Repository permissions

| Permission | Access | Required | Purpose |
|---|---|---|---|
| **Actions** | Read | ✅ Yes | Workflow runs, jobs, steps, timing |
| **Metadata** | Read | ✅ Yes | Repo names, default branch, visibility |
| **Contents** | Read | Optional | Workflow file paths in UI labels |

### Organization permissions

None required for MVP. Install the app on each org or user account to monitor.

### Account permissions (user OAuth / sign-in)

| Permission | Access | Required | Purpose |
|---|---|---|---|
| **Email addresses** | Read | ✅ Yes | `user:email` scope during sign-in |
| **Profile** (if shown separately) | Read | ✅ Yes | `read:user` scope — GitHub user identity |

PipeWatch uses the GitHub App's **Client ID** and **Client secret** for browser OAuth (`apps/api/src/services/auth/oauth.ts`), not a separate OAuth App.

### Subscribe to webhook events

Under **Permissions & events → Subscribe to events**:

| Event | Required | Purpose |
|---|---|---|
| `workflow_run` | ✅ Yes | Run created / in progress / completed |
| `workflow_job` | ✅ Yes | Job queued / in progress / completed |
| `installation` | ✅ Yes | App installed, suspended, or removed |
| `installation_repositories` | ✅ Yes | Repos added or removed from an installation |

> **Note:** The webhook handler processes `workflow_run` and `workflow_job` for enabled repos. `installation*` events are acknowledged (200) for delivery health; install persistence is driven by the install callback flow.

### Do not grant

| Permission | Reason |
|---|---|
| Actions (write) | PipeWatch does not trigger or re-run workflows |
| Contents (write) | No code changes |
| Administration | No repo settings changes |
| Pull requests, Issues, etc. | Not used for pipeline visibility |

---

## Step 3 — Generate credentials

After creating each app, collect:

| GitHub UI label | Phase / GHA key | Runtime key (Fly) | Notes |
|---|---|---|---|
| App ID | `GH_APP_ID` | `GITHUB_APP_ID` | Numeric |
| Client ID | `GH_CLIENT_ID` | `GITHUB_CLIENT_ID` | Under **OAuth credentials** |
| Client secret | `GH_CLIENT_SECRET` | `GITHUB_CLIENT_SECRET` | Generate once; rotate if leaked |
| Private key (.pem) | `GH_APP_PRIVATE_KEY` | `GITHUB_APP_PRIVATE_KEY` | Generate + download; **base64-encode** for Phase storage |
| Webhook secret | `GH_WEBHOOK_SECRET` | `GITHUB_WEBHOOK_SECRET` | Must match GitHub App webhook config |
| App slug | `GH_APP_SLUG` | `GITHUB_APP_SLUG` | From `github.com/apps/{slug}` |

**Private key handling**

1. GitHub → App → **Private keys** → **Generate a private key** (downloads `.pem` once).
2. Base64-encode the PEM for Phase: `base64 -w0 app.private-key.pem` (Linux) or `base64 -i app.private-key.pem` (macOS).
3. Store the base64 string as `GH_APP_PRIVATE_KEY` in Phase — `sync-secrets.sh` decodes before `flyctl secrets set`.

Never commit PEM files or secrets to git.

---

## Step 4 — Register secrets in Phase

Register keys in the matching Phase environment:

| Phase environment | GitHub Actions environment | GitHub App |
|---|---|---|
| **Staging** | `staging` | Staging app |
| **Production** | `production` | Production app |

Keys to set (names only — never log values):

```
GH_APP_ID
GH_APP_PRIVATE_KEY
GH_WEBHOOK_SECRET
GH_CLIENT_ID
GH_CLIENT_SECRET
GH_APP_SLUG
```

Also confirm hosted URL vars align with the environment:

| Variable | Staging | Production |
|---|---|---|
| `APP_URL` | `https://staging-cloud.pipewatch.app` | `https://cloud.pipewatch.app` |
| `MARKETING_URL` | `https://staging.pipewatch.app` | `https://pipewatch.app` |
| `NEXT_PUBLIC_API_URL` (web worker) | `https://staging-api.pipewatch.app` | `https://api.pipewatch.app` |
| `NEXT_PUBLIC_APP_URL` (marketing worker) | `https://staging-cloud.pipewatch.app` | `https://cloud.pipewatch.app` |
| `PIPEWATCH_EDITION` | `cloud` | `cloud` |

Phase Console syncs Staging/Production → GitHub Actions environments. Deploy workflows push to Fly/CF via `.github/workflows/sync-secrets.yml` (Decision #33).

**Manual secret sync (operator):**

```bash
# GitHub Actions → workflow_dispatch → sync-secrets
# Choose environment: staging | production
```

Manifest source of truth: `packages/config/sync-secrets-manifest.ts`

---

## Step 5 — Install the app

1. Ensure the target org/user is allowed (private app → org must be on the allowlist).
2. Open the install URL: `https://github.com/apps/{GH_APP_SLUG}/installations/new`
3. Choose **All repositories** or select specific repos.
4. Complete install — GitHub redirects to **Setup URL** with `installation_id` (user must already be signed in to PipeWatch; auth cookies are on the API host).
5. PipeWatch upserts the `integrations` row and redirects to onboarding step 3 (`/onboarding?step=3` on `APP_URL`).

For staging smoke tests, install on a test org or `mdg-labs` repos with low traffic.

---

## Step 6 — Verification checklist

Run after secrets sync and deploy.

### API health

```bash
# Staging
curl -sS https://staging-api.pipewatch.app/health

# Production
curl -sS https://api.pipewatch.app/health
```

Expect `{"status":"ok",...}` with correct `edition`.

### OAuth sign-in

1. Open dashboard (`staging-cloud` or `cloud`).
2. Click **Continue with GitHub**.
3. Confirm redirect chain: dashboard → `{API_URL}/auth/github` → GitHub → `{API_URL}/auth/github/callback` → dashboard/onboarding.
4. If OAuth fails with `redirect_uri` mismatch, compare GitHub **Callback URL** to the table in this runbook exactly.

### App install callback

1. Sign in, start onboarding (create workspace).
2. Install the GitHub App on a test org.
3. Confirm redirect to `{API_URL}/onboarding/github-callback?installation_id=…` → `/onboarding?step=3`.
4. If **401**, user session cookie is missing on the API host — re-sign-in via `{API_URL}/auth/github` first.

### Webhook delivery

1. Trigger a workflow on an **enabled** repo in PipeWatch.
2. GitHub App → **Advanced** → **Recent deliveries**.
3. Expect **200** for `workflow_run` / `workflow_job` events.
4. Confirm live updates on the dashboard (SSE).

### Secret preflight

`sync-secrets.sh` fails fast if required `GH_*` keys are empty in the GHA environment. After Phase updates, run `sync-secrets` workflow before relying on new credentials.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| OAuth `redirect_uri` mismatch | Callback URL points at dashboard or `/api/v1/...` | Set Callback URL to `{API_URL}/auth/github/callback` |
| Install callback **401** | No `pw_access` cookie on API host | Sign in via API OAuth; complete install in same browser session |
| Install callback **403** | User not admin/owner of active workspace | Use workspace owner account; ensure workspace context in JWT |
| Install callback **409** | Installation already linked to another workspace | Remove integration from other workspace or use different installation |
| Webhook **401** | `GITHUB_WEBHOOK_SECRET` mismatch | Rotate secret in GitHub + Phase; re-sync secrets; redeploy API |
| Webhook timeout / connection refused | API unreachable | Check Fly app health, DNS, TLS for `*-api.pipewatch.app` |
| Webhook **200** but no live data | Repo not enabled in PipeWatch | Enable repo in Settings → Integrations; confirm `installation_id` matches |
| Webhook **200** but queue stuck | Redis / worker issue | Check `pipewatch-{env}-worker` logs and Redis connectivity |
| Rate limiting during backfill | Too many repos at once | Expected — worker backs off per `X-RateLimit-Remaining` |

Webhook security: invalid `X-Hub-Signature-256` → **401**, no payload processing, no bypass flag (Decision #4).

---

## PipeWatch CE (operator note)

CE users create and own their GitHub App. Operator steps do not apply except when dogfooding CE images.

| Concern | CE behaviour |
|---|---|
| Who creates the app | Instance operator |
| Webhook URL | Operator's public API URL + `/webhooks/github` |
| OAuth callback | `{operator API URL}/auth/github/callback` |
| Env vars | `GITHUB_*` directly in `.env` (no `GH_*` mapping) |
| No public webhook | Set `PIPEWATCH_MODE=polling` or use Cloudflare Tunnel (see customer docs) |
| Manual install | Enter `installation_id` in onboarding UI → `{API_URL}/onboarding/github-callback` |

Customer docs: `apps/marketing/content/docs/github-app-setup/`

---

## Rotation & incident response

| Secret | Rotation steps |
|---|---|
| Webhook secret | Generate new secret in GitHub App → update `GH_WEBHOOK_SECRET` in Phase → `sync-secrets` → redeploy API |
| Client secret | Regenerate in GitHub → update `GH_CLIENT_SECRET` → sync → redeploy API |
| Private key | Generate new key in GitHub (old key remains valid until removed) → update `GH_APP_PRIVATE_KEY` → sync → redeploy API + worker → revoke old key in GitHub |
| Compromised webhook endpoint | Rotate webhook secret; review GitHub delivery logs; no payload bypass exists |

---

## Pre-launch checklist

- [ ] Staging GitHub App created with staging URLs
- [ ] Production GitHub App created with production URLs
- [ ] Repository permissions: Actions (read), Metadata (read)
- [ ] Account permissions: email + profile (read)
- [ ] Webhook events subscribed (4 events)
- [ ] App visibility: **Private**
- [ ] All six `GH_*` keys set in Phase Staging + Production
- [ ] `APP_URL`, `NEXT_PUBLIC_API_URL` match environment hostnames
- [ ] `sync-secrets` succeeded for both environments
- [ ] OAuth sign-in tested on staging
- [ ] App install + repo sync tested on staging
- [ ] Webhook delivery **200** on staging workflow run
- [ ] Production credentials isolated from staging (separate app, separate Phase env)

---

## References

| Document | Location |
|---|---|
| PRD environment variables | `docs/internal/PipeWatch_MVP_PRD.md` §23 |
| Sync secrets manifest | `packages/config/sync-secrets-manifest.ts` |
| OAuth implementation | `apps/api/src/routes/auth/github.ts` |
| Install callback | `apps/api/src/routes/onboarding/github-callback.ts` |
| Webhook receiver | `apps/api/src/routes/webhooks/github.ts` |
| Customer CE/Cloud setup | `apps/marketing/content/docs/github-app-setup/` |
