# PipeWatch — Page Inventory

**Status:** Draft | **Version:** 0.3 | **Author:** MDG Labs | **Date:** June 2026

Three surfaces:
- **Marketing Site** — `pipewatch.app` (public)
- **PipeWatch Cloud** — `cloud.pipewatch.app` (the app, managed)
- **PipeWatch CE** — self-hosted, same app codebase, runs at `localhost:3000` or a custom domain

PipeWatch CE and PipeWatch Cloud share the same app codebase. Edition-specific behaviour is driven by `PIPEWATCH_EDITION` (see PRD Section 26). Where a page or feature differs between editions, it's called out explicitly.

### Deployment Overview

| Surface | Prod | Staging | CF Worker (prod) | CF Worker (staging) | Stack |
|---|---|---|---|---|---|
| Marketing | `pipewatch.app` | `staging.pipewatch.app` | `pipewatch-prod-marketing` | `pipewatch-staging-marketing` | Astro on CF Workers (`@astrojs/cloudflare`) |
| App (Cloud) | `cloud.pipewatch.app` | `staging-cloud.pipewatch.app` | `pipewatch-prod-web` | `pipewatch-staging-web` | Next.js via OpenNext on CF Workers |

**Analytics:** Umami (self-hosted, existing MDG Labs instance) injected on marketing pages only — never in the app.

### Global App Conventions

These apply to all authenticated app pages (B-series) unless stated otherwise.

- **Copy / i18n:** all B-series user-visible strings (labels, empty states, errors, aria text) live in the repo JSON catalog (`apps/web/src/i18n/locales/en.json`) and render via next-intl — see PRD §17 and `.cursor/rules/16-i18n.mdc`.
- **App shell:** persistent left sidebar (workspace switcher at top, nav items, user menu at bottom) + main content area. Top bar shows breadcrumbs + global actions.
- **Workspace switcher:** dropdown at top of sidebar; lists all workspaces the user belongs to; "Create workspace" at the bottom. CE: hidden (single workspace).
- **Sidebar nav (per workspace):** Dashboard, Insights, Settings (expandable: General, Members, Integrations, API Keys, Billing). Billing hidden in CE.
- **Auth gating:** unauthenticated access to any B-page → redirect to `/sign-in?next=<path>`.
- **Role gating:** write actions hidden/disabled for `member` role; settings mutation pages require `admin` or `owner`.
- **Loading states:** skeleton loaders for data tables and cards; never a blank screen.
- **Empty states:** every list/table has a designed empty state with a clear CTA.
- **Error states:** inline error with retry for failed data loads; toast for failed mutations.
- **Live data:** pages with live data (dashboard, repo overview, run list, run detail) subscribe via SSE; a small "live" indicator shows connection status.
- **Toasts:** all mutations (save, delete, invite, etc.) produce a success/error toast.
- **Breadcrumbs (repo-scoped pages):** the `Repositories` segment links to the workspace dashboard (B3, `/workspaces/:slug`) — never `/workspaces/:slug/repos`. The repo segment label is the API `full_name` (e.g. `mdg-labs/pipewatch`), not the internal UUID.

---

# Part A — Marketing Site (`pipewatch.app`)

All marketing pages are public, server-rendered, Umami-tracked. Shared layout: top nav (logo, Pricing, Docs, Changelog, GitHub stars, "Sign in" / "Get started" or "Join waitlist" depending on `LAUNCH_MODE`) + footer (product links, legal, social, GitHub).

---

## A1. Homepage `/`

**Purpose:** Primary landing page. Communicate value, convert to signup or waitlist.

**Layout (top to bottom):**
1. **Hero** — bold headline, one-line subheadline, primary CTA + secondary "View on GitHub". Right side or background: live-looking dashboard preview (static image or subtle animation).
2. **Social proof bar** — GitHub stars, "self-hostable", key tech badges (post-launch: user count).
3. **Problem/solution section** — "Tired of tab-switching between repos?" framing with a visual.
4. **Feature highlights** — 3–4 feature blocks alternating image/text: Live pipeline view, Multi-repo dashboard, Insights, Self-hostable.
5. **Editions section** — side-by-side: PipeWatch Cloud (managed) vs PipeWatch CE (self-hosted, free).
6. **Pricing preview** — 3 plan cards (Free/Pro/Business) with "see full pricing" link.
7. **Final CTA band** — repeat primary CTA.
8. **Footer.**

**Functions:**
- Primary CTA → `/waitlist` (pre-launch) or `cloud.pipewatch.app` signup (live), driven by `LAUNCH_MODE`
- "View on GitHub" → repo
- Smooth-scroll anchor nav to sections
- All interactions Umami-tracked (CTA clicks, section views)

---

## A2. Pricing `/pricing`

**Purpose:** Detailed plan comparison, answer pricing objections, convert.

**Layout:**
1. **Heading + billing toggle** — monthly/annual switch (annual post-MVP; toggle can be present but inert or hidden).
2. **Plan cards row** — Free / Pro / Business: price, key limits (repos, retention, members), feature checklist, CTA. "Most popular" badge on Pro.
3. **Full comparison table** — every feature × plan, future features marked "soon".
4. **Self-hosting callout** — "Want it all for free? Self-host PipeWatch CE" → docs link.
5. **FAQ accordion** — "What counts as a repo?", "What happens at the repo limit?", "Can I self-host for free?", "Can I switch plans?", "Refunds?".
6. **Final CTA.**

**Functions:**
- Plan CTA → `/waitlist` (pre-launch) or signup with plan preselected (live)
- Billing toggle recalculates displayed prices
- FAQ accordion expand/collapse
- Umami-tracked plan CTA clicks

---

## A3. Docs `docs.pipewatch.app` (Documentation.AI)

**Purpose:** Getting-started and self-hosted reference for customers and operators.

**Hosting:** [`mdg-labs/pipewatch-docs`](https://github.com/mdg-labs/pipewatch-docs) → Documentation.AI at **https://docs.pipewatch.app**. Authored as MDX + `documentation.json` (not in the marketing app).

**Marketing redirect:** `pipewatch.app/docs` and `pipewatch.app/docs/*` → 308 to `docs.pipewatch.app` (preserves bookmarks).

**Content tree:**
- Getting Started → Cloud quickstart, CE quickstart (Docker Compose)
- GitHub App Setup → creating the app, permissions & events, webhook URL, Cloudflare Tunnel guide
- Concepts → Workspaces, Integrations, Run lifecycle, Webhook vs Polling mode, Editions
- Self-Hosted (CE) Reference → environment variables, Docker Compose config, upgrading, backups
- API Reference → link to `api.pipewatch.app/api/docs` (Scalar)

**Functions (Documentation.AI platform):**
- Sidebar navigation, search, on-page TOC
- Copy-to-clipboard on code blocks (platform)
- Edit via GitHub / Documentation.AI editor
- Navbar links to GitHub repo and PipeWatch Cloud

---

## A4. Changelog `/changelog`

**Purpose:** Transparent release history.

**Layout:** single column, reverse-chronological timeline. Each entry: version tag + date header, summary line, grouped bullet lists (Features / Fixes / Breaking), optional "full release" link.

**Functions:**
- Markdown-driven (entries are repo files)
- Anchor link per version
- (Post-MVP) filter by change type
- Link to GitHub release per entry

---

## A5. Waitlist `/waitlist`

**Purpose:** Email capture before launch. Cloud-only (`WAITLIST_ENABLED`).

**Layout:** centered, minimal — value-prop headline, one-line subtext, email input + submit, success state replacing the form on submit. Optional rough launch-timeline line.

**Functions:**
- Submit → `POST /api/v1/waitlist` → double opt-in email via Postmark → row in `subscribers`
- Inline email validation, idempotent duplicate handling ("already on the list")
- Success state after submit
- Confirm link in email → `GET /api/v1/waitlist/confirm/:token`
- Redirects to `/` when `LAUNCH_MODE=live`

---

## A6. Legal `/privacy`, `/terms`

**Purpose:** Required legal pages.

**Layout:** single-column long-form prose, last-updated date, section anchors.

**Functions:** static MDX; required before public launch. Privacy must cover Umami (anonymous), Postmark (waitlist), Stripe (billing), GitHub OAuth data.

---

## A7. Waitlist Confirm / Unsubscribe `/waitlist/confirm`, `/unsubscribe`

**Purpose:** Landing pages for email-link actions.

**Layout:** centered single-message card with status (confirmed / unsubscribed / invalid-or-expired) and a link back to `/`.

**Functions:**
- Confirm: validates token, sets `confirmed_at`, success state
- Unsubscribe: validates token, sets `unsubscribed_at`, confirmation state

---

# Part B — App (`cloud.pipewatch.app` / CE)

---

## B0. CE Bootstrap `/setup`

**Edition:** CE only (`BOOTSTRAP_ENABLED`). Active only while `users` count = 0.

**Purpose:** First-run admin account creation for self-hosted instances.

**Layout:** centered, no app shell — "Welcome to PipeWatch CE" card: product mark, one-line welcome, "Sign in with GitHub to create your admin account" button, note that this user becomes the owner.

**Functions:**
- "Sign in with GitHub" → OAuth → first user created as `owner`
- Auto-creates default workspace "My Workspace"
- Redirects into onboarding wizard at step 2 (workspace already exists)
- Once user count > 0: permanently redirects to `/sign-in`
- If `PIPEWATCH_EDITION=cloud`: returns 404

---

## B1. Sign In `/sign-in`

**Purpose:** Entry point for returning users (both editions).

**Layout:** centered card, no app shell — logo, "Sign in to PipeWatch", single "Sign in with GitHub" button, link to marketing site. Respects `?next=`.

**Functions:**
- "Sign in with GitHub" → `GET /auth/github` → OAuth → callback
- On success: redirect to `?next=`, or last-visited workspace, or workspace switcher (if multiple), or onboarding (if zero)
- CE first-run: if user count = 0, redirect to `/setup`
- CSRF-protected via signed state cookie

---

## B2. Onboarding Wizard `/onboarding`

**Purpose:** Guide user from new account / new workspace through first connected repo. URL-tracked steps (`?step=N`). Also reached via `/workspaces/new`.

**Layout:** centered wizard card with a step progress indicator (1–4) at top, step content in the middle, back/next at bottom. Minimal chrome.

**Step 1 — Create Workspace (`?step=1`)**
- Fields: workspace name (auto-derives slug, slug editable with availability check)
- Cloud: plan selector (Free default, upgrade hint); CE: no plan selector
- Action: "Create workspace" → `POST /api/v1/workspaces` → advance

**Step 2 — Install GitHub App (`?step=2`)**
- Explainer: permissions (Actions read, Metadata read), events (`workflow_run`, `workflow_job`)
- "Install GitHub App" → `https://github.com/apps/pipewatch/installations/new`
- Returns via `GET /onboarding/github-callback?installation_id=...` → auto-advance
- CE fallback: manual `installation_id` entry

**Step 3 — Select Repos & Backfill (`?step=3`)**
- Discovered repos list, multi-select, all selected by default, search/filter for large lists
- Cloud Free: repo-limit badge + enforcement; CE: no limit
- Action: "Start syncing" → enables repos → enqueues backfill
- Live backfill progress; "Go to Dashboard" available immediately

**Step 4 — Done (`?step=4`)**
- Success summary: N repos connected, backfill in progress
- Quick tips; "Go to Dashboard" → `/workspaces/:slug/`

**Functions:**
- Step resumption from DB state (workspace exists → skip 1; integration exists → skip 2)
- Each step validates before advancing; back navigation preserved in URL
- Re-entrant: reachable later via "Add workspace" / "Connect another org"

---

## B3. Dashboard `/workspaces/:slug/`

**Purpose:** Bird's-eye view of all repos in the workspace. Primary landing page.

**Layout:**
- **Top:** global health bar — segmented summary (healthy / running / failing) + total repo count as a horizontal stat strip.
- **Controls row:** sort dropdown, status filter chips (All / Failing / Running / Healthy), integration filter (if multiple orgs), view toggle (cards / table).
- **Main:** responsive grid of repo cards (default) or dense table.
  - **Repo card:** repo name (+ GitHub link), last-run status badge, last workflow + branch, relative time, duration, 7-day failure-rate sparkline, live "running" pulse if active.
- **Empty state:** "No repos connected yet" → "Connect GitHub" → onboarding step 2.

**Functions:**
- Sort: last run / name / failure rate
- Filter: status, integration
- View toggle: cards ↔ table (persisted in UI state)
- Click repo → B4
- "Connect another org" → onboarding
- Live updates via SSE per repo (status + running pulse without refresh)
- Live connection indicator

---

## B4. Repository Overview `/workspaces/:slug/repos/:repoId`

**Purpose:** Curated per-repo dashboard — summary health, failing workflows, and active runs. Primary landing when clicking a repo from B3.

**Layout:**
- **Header:** repo `full_name`, visibility badge, GitHub link, sync-mode badge (Webhook/Polling), "Settings" button (→ B5), "Re-sync" action.
- **Breadcrumb:** `Repositories` → B3 (`/workspaces/:slug`); repo segment label = `full_name`.
- **Active-run banner:** prominent live banner when any run is in progress (links to B6 or B4-runs).
- **Time-range toggle:** 7d / 30d for summary widgets.
- **Summary cards row:** total runs, success rate, avg duration — sourced from `GET /insights?repoId=…&range=7d|30d` (PRD §12.5).
- **Most failing workflows:** compact table (workflow name, failure rate %, failure count) for the selected range.
- **CTA:** "View all runs" → B4-runs.
- **Empty state:** "No runs yet for this repo" with re-sync CTA.

**Functions:**
- Time range toggle (7d/30d) refreshes summary cards and failing-workflows table
- Click failing-workflow row → B4-runs pre-filtered by workflow
- Active-run banner updates via SSE while runs are in progress
- "View all runs" → B4-runs
- "Re-sync" → manual GitHub re-fetch
- "Settings" → B5

---

## B4-runs. Repository Runs List `/workspaces/:slug/repos/:repoId/runs`

**Purpose:** Full filterable, paginated run history for a single repository.

**Layout:**
- **Header:** repo `full_name`, visibility badge, GitHub link, sync-mode badge (Webhook/Polling), "Settings" button (→ B5), "Re-sync" action; optional link back to B4 overview.
- **Breadcrumb:** `Repositories` → B3; repo segment (`full_name`) → B4 overview; current segment "Runs".
- **Active-run banner:** prominent live banner if any run in progress.
- **Workflow tabs:** "All" + one tab per distinct workflow.
- **Filters row:** branch, workflow, status, trigger event, date range.
- **Run list table:** paginated (20/page). Columns: workflow name, branch, trigger, actor (avatar + login), status badge, duration, started-at (relative), → chevron.
- **Empty state:** "No runs yet for this repo."

**Functions:**
- Filter by branch / workflow / status / trigger / date range (URL-encoded, shareable)
- Pagination
- Click run → B6
- Live updates via SSE — in-progress rows update live, new runs prepend
- "Re-sync" → manual GitHub re-fetch
- "Settings" → B5

---

## B5. Repository Settings `/workspaces/:slug/repos/:repoId/settings`

**Purpose:** Per-repo configuration. Requires admin/owner.

**Layout:** single-column settings form, grouped sections with headers, danger zone visually separated (red-tinted) at bottom.

**Sections:**
1. **Header:** repo name, GitHub link.
2. **Sync mode:** radio Webhook (default) / Polling. If Polling: interval input (default 60s, min 30s, validated).
3. **Retention:** "Use plan default" toggle vs custom value (days). Cloud: clamped to plan range (30–365), ceiling shown inline. CE: free input, no ceiling.
4. **Danger zone:** Disable repo (stops syncing, keeps data) / Delete repo data (purges runs — confirm modal).

**Functions:**
- Save sync mode + interval → `PATCH .../repositories/:repoId`
- Save retention override (plan-clamp on cloud)
- Disable / re-enable repo
- Delete repo data (typed confirmation modal)
- All mutations → toast + optimistic UI

---

## B6. Run Detail `/workspaces/:slug/repos/:repoId/runs/:runId`

**Purpose:** Full drill-down into a single workflow run.

**Layout:**
- **Header:** pipeline name, status badge, total duration, started/completed timestamps. Sub-line: branch, commit SHA (GitHub link) + message, actor, trigger. "View on GitHub" button (uses `source_url` from API).
- **Job graph:** visual DAG of jobs (sequential + parallel lanes). Node: job name, status badge, duration, runner name; running jobs show live elapsed time.
- **Job panels:** expandable list below the graph. Each job → its steps.
  - **Step row:** number, name, status badge, duration. Failed steps highlighted (red), auto-expanded.
- **Breadcrumb:** repo segment (`full_name`) → B4 overview; optional "All runs" → B4-runs; `Repositories` → B3 dashboard.

**Functions:**
- Expand/collapse job panels (failed auto-expanded)
- Job graph node click → scroll to / expand that job's panel
- "View on GitHub" → `pipeline_runs.source_url` (full logs on GitHub; no log storage in MVP)
- Live updates via SSE while in progress (status, durations, step transitions)
- Live elapsed-time ticker on running jobs

---

## B7. Insights `/workspaces/:slug/insights`

**Purpose:** Performance & reliability trends across all repos in the workspace.

**Layout:**
- **Controls:** time-range toggle (7d / 30d), repo filter, workflow filter.
- **Summary cards row:** Total runs, Overall success rate, Avg run duration, Most active repo — stat cards with value + trend indicator.
- **Charts grid:** per-workflow duration over time (line), per-workflow failure rate over time (line).
- **Tables:** Slowest Workflows (avg, p50, p95, trend), Most Failing Workflows (failure rate %, count, trend).
- **Empty state:** "Not enough data yet — insights appear once runs are recorded."

**Functions:**
- Switch time range (7d/30d)
- Filter by repo / workflow (URL-encoded)
- Click workflow name in tables → deep-link to B4-runs pre-filtered (`…/repos/:repoId/runs?workflow=…`)
- Charts: hover tooltips, responsive

---

## B8. Workspace Settings — General `/workspaces/:slug/settings`

**Purpose:** General workspace configuration. Requires admin/owner.

**Layout:** single-column settings form; sections; danger zone at bottom.

**Sections:**
1. **General:** name (editable), slug (editable with URL-change warning + availability check).
2. **Plan summary (cloud):** current plan badge, "Manage billing" → B12. Hidden in CE.
3. **Default retention (cloud, paid):** workspace-level default used by repos set to "plan default".
4. **Danger zone:** delete workspace (typed confirm; blocked if user's only workspace on CE).

**Functions:**
- Save name/slug → `PATCH .../workspaces/:id`
- Delete workspace (typed confirm modal)
- Slug change warns about breaking existing URLs

---

## B9. Members `/workspaces/:slug/settings/members`

**Purpose:** Manage workspace access. Requires admin/owner to mutate.

**Layout:** two stacked tables — active members, then pending invites. "Invite member" button top-right opens a modal.

**Active members table:** avatar, name, email, role badge, joined date, row actions (change role, remove).
**Pending invites table:** email, role, invited-at, expiry, actions (resend, revoke).

**Functions:**
- Invite → modal (email + role) → `POST .../invites` → email via SMTP
- Change role (owner/admin only; can't demote last owner)
- Remove member (confirm)
- Resend / revoke pending invite
- Leave workspace (own row; disabled if sole owner)
- Role-gated: members get read-only view

---

## B10. Integrations `/workspaces/:slug/settings/integrations`

**Purpose:** Manage connected GitHub App integrations. Requires admin/owner. MVP: GitHub only (`integrations.provider = 'github'`).

**Layout:** list of integration cards. Each: account name + type (Org/User) badge, connected-repos count, connected-at, expand for per-repo enable/disable toggles. "Add integration" button top.

**Functions:**
- Add integration → GitHub App install page → callback
- Remove integration → disconnects all its repos (confirm modal)
- Per-repo enable/disable toggle (disabled = stored, not synced)
- Manual "Re-sync" per integration
- Integration token health/last-refresh (read-only)

---

## B11. API Keys `/workspaces/:slug/settings/api-keys`

**Purpose:** Manage programmatic API access. All editions/plans. Requires admin/owner.

**Layout:** table of active keys + "Create API key" button (modal). Revoked keys behind a "show revoked" toggle.

**Keys table:** name, prefix (first 8 chars), created-by, created-at, last-used, expiry, revoke action.
**Create modal:** name input, optional expiry → on submit shows full key once with copy button + "you won't see this again" warning.

**Functions:**
- Create key → `POST .../api-keys` → one-time reveal
- Revoke key (confirm) → `DELETE .../api-keys/:keyId`
- Copy prefix for identification
- Empty state explains API keys + link to API docs

---

## B12. Billing `/workspaces/:slug/settings/billing`

**Edition:** Cloud only (`BILLING_ENABLED`). Hidden in CE. Requires owner.

**Purpose:** Plan management and usage overview.

**Layout:**
1. **Current plan card:** name, price, next billing date, status.
2. **Usage panel:** repos used / limit, retention setting, members used / limit — progress bars, warnings near limits.
3. **Plan options:** upgrade/downgrade cards.
4. **Payment & invoices:** payment method (Stripe-managed), invoice history table.

**Functions:**
- Upgrade/downgrade → Stripe Checkout (`POST .../billing/checkout`) or Billing Portal
- Update payment method → Billing Portal (`POST .../billing/portal`)
- Cancel → portal (downgrades to Free at period end)
- Usage reflects live plan-limit state
- Invoice history from Stripe

---

## B13. Account Settings `/account`

**Purpose:** Personal, cross-workspace user settings.

**Layout:** single-column. Sections: Profile, Connected accounts, Workspaces, Sessions, Danger zone.

**Sections:**
1. **Profile:** name (editable), email + avatar (from GitHub, read-only).
2. **Connected accounts:** GitHub (always connected).
3. **Workspaces:** list + role; quick-switch.
4. **Sessions:** "Log out everywhere" (revokes all refresh tokens).
5. **Danger zone:** delete account (confirm; blocked if sole owner of a shared workspace).

**Functions:**
- Update display name
- Switch workspace → dashboard
- Logout-all → `POST /auth/logout-all`
- Delete account (typed confirm)

---

## B14. API Docs `/api/docs`

**Purpose:** Interactive API reference. Public to view. Auto-generated from `@hono/zod-openapi` via Scalar.

**Layout:** Scalar UI — left endpoint nav grouped by resource, center schemas, right "try it" panel.

**Functions:**
- Browse endpoints + schemas (auto-generated from Zod)
- Auth instructions (Bearer / API key)
- "Try it" live requests
- Copy curl/code snippets
- Download spec → `/api/v1/openapi.json`

---

## System & Callback Routes (not user-facing pages)

### B15. OAuth Initiate `GET /auth/github`
Redirects to GitHub OAuth with signed state cookie (CSRF).

### B16. OAuth Callback `GET /auth/github/callback`
Validates state, exchanges code, upserts user, issues JWT + refresh token, redirects (onboarding / dashboard / `?next=`).

### B17. GitHub App Install Callback `GET /onboarding/github-callback`
Receives GitHub `installation_id`, persists `integrations` row (`provider = 'github'`), kicks off repo discovery, returns to wizard step 3.

### B18. Invite Accept `/invite/:token`
Public landing from invite email. Logged out → `/sign-in?next=/invite/:token`. Logged in → shows workspace + role, "Accept" → `POST /invite/:token/accept` → joins → dashboard. Expired/invalid → error state.

### B19. Webhook — GitHub `POST /webhooks/github`
Validates `X-Hub-Signature-256` (HMAC-SHA256, `timingSafeEqual`), rejects invalid with 401, enqueues to BullMQ, returns 200 immediately.

### B20. Webhook — Stripe `POST /webhooks/stripe` (cloud only)
Validates Stripe signature, handles subscription lifecycle, syncs `workspaces.plan`.

### B21. Webhook — Postmark `POST /webhooks/postmark` (cloud only)
Handles bounce + unsubscribe to keep `subscribers` clean.

### B22. SSE Stream `GET /workspaces/:slug/repos/:repoId/stream`
Live run/job updates. Auth via one-time query token (`GET /api/v1/sse-token`). Heartbeat every 30s.

---

## Summary Table

| # | Route | Surface | Auth | Edition / Notes | MVP |
|---|---|---|---|---|---|
| A1 | `/` | Marketing | No | | ✓ |
| A2 | `/pricing` | Marketing | No | | ✓ |
| A3 | `docs.pipewatch.app` (external) | Marketing redirects `/docs` | No | | ✓ |
| A4 | `/changelog` | Marketing | No | | ✓ |
| A5 | `/waitlist` | Marketing | No | Cloud (`WAITLIST_ENABLED`) | ✓ |
| A6 | `/privacy`, `/terms` | Marketing | No | | ✓ |
| A7 | `/waitlist/confirm`, `/unsubscribe` | Marketing | No | Cloud | ✓ |
| B0 | `/setup` | App | No | CE only | ✓ |
| B1 | `/sign-in` | App | No | | ✓ |
| B2 | `/onboarding` (`/workspaces/new`) | App | Yes | | ✓ |
| B3 | `/workspaces/:slug/` | App | Yes | | ✓ |
| B4 | `/workspaces/:slug/repos/:repoId` | App | Yes | Per-repo overview dashboard | ✓ |
| B4-runs | `/workspaces/:slug/repos/:repoId/runs` | App | Yes | Full filterable run list | ✓ |
| B5 | `/workspaces/:slug/repos/:repoId/settings` | App | Yes | admin/owner | ✓ |
| B6 | `/workspaces/:slug/repos/:repoId/runs/:runId` | App | Yes | | ✓ |
| B7 | `/workspaces/:slug/insights` | App | Yes | | ✓ |
| B8 | `/workspaces/:slug/settings` | App | Yes | admin/owner | ✓ |
| B9 | `/workspaces/:slug/settings/members` | App | Yes | admin/owner to mutate | ✓ |
| B10 | `/workspaces/:slug/settings/integrations` | App | Yes | admin/owner | ✓ |
| B11 | `/workspaces/:slug/settings/api-keys` | App | Yes | admin/owner, all editions | ✓ |
| B12 | `/workspaces/:slug/settings/billing` | App | Yes | owner, Cloud only | ✓ |
| B13 | `/account` | App | Yes | | ✓ |
| B14 | `/api/docs` | App | No | | ✓ |
| B15 | `GET /auth/github` | System | No | | ✓ |
| B16 | `GET /auth/github/callback` | System | No | | ✓ |
| B17 | `GET /onboarding/github-callback` | System | Yes | | ✓ |
| B18 | `/invite/:token` | App | No (redirects) | | ✓ |
| B19 | `POST /webhooks/github` | System | Signed | | ✓ |
| B20 | `POST /webhooks/stripe` | System | Signed | Cloud only | ✓ |
| B21 | `POST /webhooks/postmark` | System | Signed | Cloud only | ✓ |
| B22 | `GET .../repos/:repoId/stream` | System | One-time token | | ✓ |

---

*PipeWatch Page Inventory v0.3 — MDG Labs — June 2026*
