# PipeWatch — MVP Product Requirements Document

**Status:** Draft | **Version:** 0.7 | **Author:** MDG Labs | **Date:** June 2026

---

## 1. Overview

PipeWatch is an open-core GitHub Actions dashboard (PipeWatch CE = self-hosted, PipeWatch = managed cloud) that aggregates workflow runs across multiple repositories into a single, real-time interface. It provides live pipeline visibility, run history, and performance/error insights — everything GitHub's native UI lacks when working across multiple repos.

The product ships in two distribution modes:

- **PipeWatch CE (Community Edition)** — self-hosted, Docker Compose, free forever
- **PipeWatch** (Cloud) — managed, hosted on `cloud.pipewatch.app`, fair-priced plans

---

## 2. Goals & Non-Goals

### Goals

- Ship a working, self-hostable MVP that solves the multi-repo Actions visibility problem
- Establish the GitHub App integration as the foundation for real-time data
- Provide genuine live pipeline view — not near-real-time polling
- Keep PipeWatch CE setup as simple as possible — single `docker compose up`
- Multi-tenancy via Workspaces from day one — no retrofitting later
- Full CRUD parity across all API resources from day one
- Code-generated, always-accurate API documentation
- Build a foundation that can grow into a commercial cloud product post-MVP

### Non-Goals (MVP)

- Webhook Gateway / relay for private self-hosted instances — post-MVP
- Alerts & notification channels (Slack, email) — post-MVP
- Re-running workflows from PipeWatch — post-MVP
- SSO — post-MVP
- Log storage — metadata + step results only, no raw log ingestion (both editions)
- GitHub Enterprise Server support — out of scope for now
- Additional CI platforms (GitLab CI, CircleCI, etc.) — post-MVP; core schema reserved for future providers (Decision #37)

---

## 3. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| Solo Dev / Indie Hacker | Works across 3–10 repos, often multiple projects | Single view of all pipelines without tab-switching |
| Small Team (2–8 devs) | Shared repos, multiple workflows per repo | Team-wide pipeline health at a glance |
| CE Self-hoster | Privacy-conscious, wants full control | Docker Compose install (PipeWatch CE), no cloud dependency |
| Cloud User | Wants zero-infra setup | Just works, fair pricing |

---

## 4. Architecture

### 4.1 High-Level Data Flow

```
GitHub Webhooks
      │
      ▼
Webhook Receiver (Hono on Fly.io)  ──► BullMQ Queue (Redis on Fly.io)
      │
      ▼
Ingestion Worker (Fly.io Machine)  ──► Neon PostgreSQL
      │
      ▼
API Layer (Hono on Fly.io)  ──► Frontend (Next.js on Cloudflare Workers)
```

On initial installation, PipeWatch performs a one-time historical sync via GitHub REST API to backfill existing run history. After that, all updates arrive via Webhooks only — no polling in steady state.

### 4.2 Infrastructure (Cloud)

| Component | Service | Notes |
|---|---|---|
| API + Webhook Receiver | Fly.io (Hono app) | Single app, two route groups |
| Background Worker | Fly.io Machine | BullMQ consumer, scales to zero |
| Database | Neon PostgreSQL | Serverless, branching for preview envs |
| Cache / Queue | Redis on Fly.io | `fly-redis` volume-backed app, cheapest for MVP |
| Frontend / Dashboard | Cloudflare Workers (Next.js via OpenNext) | Consistent with Dispatch One stack |
| Marketing Site | Cloudflare Workers (Next.js via OpenNext) | Separate CF Workers project, separate domain |
| Marketing Analytics | Umami (self-hosted, existing instance) | Script injected into marketing site only |
| Secrets Management | Phase Cloud (EU/Frankfurt) | E2E encrypted, SOC 2 Type II, GDPR-compatible |
| Error Monitoring | Sentry | Full stack: traces, source maps, logs, sessions |

### 4.3 Deployment Naming & Domains

Domain: `pipewatch.app` (secured)

| Service | Staging | Production |
|---|---|---|
| **Marketing Site** | `staging.pipewatch.app` | `pipewatch.app` |
| CF Worker name | `pipewatch-staging-marketing` | `pipewatch-prod-marketing` |
| **Frontend (App)** | `staging-cloud.pipewatch.app` | `cloud.pipewatch.app` |
| CF Worker name | `pipewatch-staging-web` | `pipewatch-prod-web` |
| **Backend API** | `staging-api.pipewatch.app` | `api.pipewatch.app` |
| Fly.io app name | `pipewatch-staging-api` | `pipewatch-prod-api` |
| **Worker** | — | — |
| Fly.io app name | `pipewatch-staging-worker` | `pipewatch-prod-worker` |
| **Redis** | — | — |
| Fly.io app name | `pipewatch-staging-redis` | `pipewatch-prod-redis` |

**Environment naming** — for CI/CD and hosted deploys, **GitHub Actions environments** are what workflows use.

**Secret flow (one direction from Phase):**

```
Phase  ──(Phase Console sync)──►  GitHub Actions environments  ──(workflow code)──►  Fly.io / CF Workers
         only external sync              staging | production | ci        sync-secrets.yml, deploy workflows
```

Phase never syncs directly to Fly.io or Cloudflare Workers. The operator configures Phase→GitHub Actions sync in Phase Console; deploy workflows push secrets from a GitHub Actions environment to Fly/CF at deploy time.

Phase environment names use **title case** (`Development`, `Staging`, `Production`, `CI`) — as defined in Phase Console. GitHub Actions environment names are **lowercase slugs** (`staging`, `production`, `ci`). Infrastructure resource names use a short `prod` slug for production.

| | Staging | Production | CI |
|---|---|---|---|
| **Phase environment** | Staging | Production | CI |
| **GitHub Actions environment** | `staging` | `production` | `ci` |
| **Infrastructure slug** (Fly.io, CF Workers) | `staging` | `prod` | — |

**Development** (Phase only) — local dev via Phase CLI; no GitHub Actions environment, no sync.

Deploy workflows set `environment: staging` or `environment: production`. CI test workflows that need secrets set `environment: ci`. Fly.io and Cloudflare Worker resource names use the `prod` slug for production (`pipewatch-prod-api`, not `pipewatch-production-api`).

### 4.4 GitHub Integration

| Concern | Approach |
|---|---|
| Integration type | GitHub App (not OAuth App, not PAT) |
| Auth flow | GitHub App installation per org or user account |
| Tokens | Short-lived Installation Tokens (auto-refreshed, max 1h) |
| Realtime updates | Webhooks — `workflow_run` and `workflow_job` events |
| Webhook security | HMAC-SHA256 via `X-Hub-Signature-256`, verified with `timingSafeEqual` before any processing |
| Initial backfill | REST API on first install — list runs per repo, paginated |
| Self-hosted endpoint | Must be publicly reachable; Cloudflare Tunnel recommended in docs |
| Polling fallback | Optional — user-configurable interval per repo (default 60s, min 30s); stored as `polling_interval_seconds` on `repositories` table |

### 4.5 CI Provider Schema (MVP: GitHub only)

MVP ships **GitHub Actions only** — no second CI platform, no provider picker, no adapter framework. The persistent schema and public API types use **vendor-neutral names** so a future provider (e.g. GitLab CI) can be added without renaming tables or columns (Decision #37).

| Layer | MVP approach |
|---|---|
| Database (`packages/db`) | Neutral: `integrations`, `pipeline_runs`, `external_*` IDs, `integrations.provider` (MVP: only `github`) |
| API types (`packages/types`) | Neutral: `Integration`, `PipelineRun`, `PipelineJob`, `PipelineStep` |
| Ingestion (`apps/api`, `apps/worker`) | GitHub-specific: webhook verification, REST client, payload parsing, backfill |
| Product / UI | GitHub Actions only: "Install GitHub App", `POST /webhooks/github`, link to GitHub for logs |

GitHub webhook event names (`workflow_run`, `workflow_job`) and callback query params (`installation_id`) stay GitHub-specific at the integration boundary. Workers map GitHub payloads into the neutral `pipeline_*` tables at write time.

### 4.6 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend API | Node.js + Hono | Lightweight, TypeScript-native, OpenAPI-friendly |
| API Docs | Hono + `@hono/zod-openapi` + Scalar | Code-generated from route definitions, always in sync |
| Job Queue | BullMQ + Redis | Battle-tested, self-hostable |
| Database | Neon PostgreSQL | Serverless, preview branches, consistent with existing stack |
| ORM / Migrations | Drizzle ORM | TypeScript-native, lightweight, good Neon support |
| Frontend | Next.js (App Router) via OpenNext | SSR for dashboard, deploys to Cloudflare Workers |
| Auth | JWT-based (custom) + API Keys | See Section 7.1 — Better Auth evaluated but custom JWT fits API-key requirement better |
| Self-hosted delivery | Docker Compose | Single file, bundles Postgres + Redis |
| Secrets | Phase Cloud (EU/Frankfurt) | E2E encrypted; operator syncs to GitHub Actions environments via Phase Console; SOC 2 Type II |
| Error Monitoring | Sentry (full) | Traces, source map upload, logs (GA), session replay |
| Testing | Vitest (unit/integration) + Playwright (e2e) | See Section 11 |

### 4.7 Open-Core Split

| Feature | PipeWatch CE | PipeWatch Cloud |
|---|---|---|
| Multi-repo dashboard | ✓ | ✓ |
| Workspaces (multi-tenancy) | ✓ (single workspace) | ✓ (multiple workspaces) |
| Live pipeline view (Webhooks) | ✓ (requires public endpoint) | ✓ (native) |
| Run history retention | unlimited (configurable) | plan-based (30d / 90d / 1y) |
| Job & Step drill-down | ✓ | ✓ |
| Basic insights (duration, failure rate) | ✓ | ✓ |
| Polling fallback mode | ✓ | ✓ |
| Full API access + API Keys | ✓ | ✓ (Free+) |
| Docker Compose self-host | ✓ | — |
| Billing / Plans | — (all features free) | ✓ |
| Waitlist / Newsletter | — | ✓ |
| Webhook Gateway (future) | ✓ | ✓ |
| Alerts & Notifications (future) | ✓ | ✓ |
| SSO (future) | ✓ | ✓ (Business) |
| Advanced analytics (future) | ✓ | ✓ (Pro+) |

---

## 5. Multi-Tenancy — Workspaces

Multi-tenancy is a first-class concern from day one. The top-level isolation unit is a **Workspace**.

### Concepts

- A **Workspace** maps to one or more GitHub App integrations (orgs or user accounts; stored as `integrations` rows with `provider = 'github'`)
- A **User** can be a member of multiple Workspaces with a role per Workspace
- All resources (integrations, repositories, pipeline runs, insights) are scoped to a Workspace
- All API endpoints are workspace-scoped: `/api/v1/workspaces/:workspaceId/...`

### Roles (MVP)

| Role | Permissions |
|---|---|
| Owner | Full CRUD, manage members, billing, delete workspace |
| Admin | Full CRUD on all resources, manage members (cannot delete workspace or touch billing) |
| Member | Read all resources, no write access |

### Data Model Additions

**`workspaces`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text unique | URL-safe identifier |
| name | text | Display name |
| plan | text | free \| pro \| business |
| stripe_customer_id | text | null for self-hosted / free |
| stripe_subscription_id | text | null for free tier |
| created_at | timestamptz | |

**Retention rules by plan:**
- Free: always 30 days, not configurable
- Pro: 30–365 days (workspace-level default, overridable per repo within range)
- Business: 30–365 days (same)
- PipeWatch CE: defaults to 30 days, overridable via `RETENTION_DAYS` env var (no ceiling enforced)

**`workspace_members`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| user_id | uuid FK | → users |
| role | text | owner \| admin \| member |
| invited_at | timestamptz | |
| accepted_at | timestamptz | null until accepted |

All existing entities (`integrations`, `repositories`, `pipeline_runs`, etc.) gain a `workspace_id` FK column.

---

## 6. Core Data Model

All timestamps UTC. MVP schema — subject to change.

**CI provider note (Decision #37):** Table and column names are vendor-neutral. MVP only accepts `provider = 'github'` on `integrations`. GitHub-specific IDs are stored in `external_*` columns (as text). Unique constraints are composite per repo/integration — not global `github_*` uniques.

### `users`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| github_id | bigint unique | GitHub user ID |
| github_login | text | GitHub username |
| email | text | From GitHub profile |
| name | text | Display name |
| avatar_url | text | GitHub avatar |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | → users |
| token_hash | text unique | sha256 of token — never stored plain |
| expires_at | timestamptz | 30 days from issue |
| revoked_at | timestamptz | null = active; set on logout or rotation |
| created_at | timestamptz | |

One row per active session. On logout-all-sessions: revoke all rows for user. On refresh: rotate (revoke old, insert new).

### `workspace_invites`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| created_by | uuid FK | → users |
| email | text | Invitee email |
| role | text | owner \| admin \| member |
| token | uuid unique | Used in invite link |
| expires_at | timestamptz | 7 days from creation |
| accepted_at | timestamptz | null until accepted |
| created_at | timestamptz | |

### `integrations`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| provider | text | `github` (MVP — only value allowed) |
| external_installation_id | text | Provider-native ID; GitHub App installation ID from install event |
| account_login | text | Org or user slug |
| account_type | text | Organization \| User |
| access_token | text (encrypted) | Current installation token |
| token_expires_at | timestamptz | Auto-refresh before expiry |
| created_at | timestamptz | |

**Unique:** `(provider, external_installation_id)`

### `repositories`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| integration_id | uuid FK | → integrations |
| external_repo_id | text | Provider-native repo ID |
| full_name | text | e.g. mdg-labs/inboxops |
| private | boolean | |
| enabled | boolean | false = stored but not synced |
| polling_interval_seconds | int | null = webhook mode; default 60 in polling mode, min 30 |
| retention_days | int | null = use plan default; must be within plan range (30–365 for paid, fixed 30 for free) |
| last_synced_at | timestamptz | For backfill tracking |

**Unique:** `(integration_id, external_repo_id)`

### `pipeline_runs`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| repo_id | uuid FK | → repositories |
| external_run_id | text | Provider-native run ID |
| pipeline_name | text | Workflow/pipeline display name |
| pipeline_definition_ref | text | e.g. `.github/workflows/ci.yml` |
| status | text | queued \| in_progress \| completed |
| conclusion | text | success \| failure \| cancelled \| skipped \| null |
| branch | text | |
| commit_sha | text | |
| commit_message | text | |
| actor_login | text | Who triggered the run |
| trigger_type | text | push \| pull_request \| schedule \| workflow_dispatch \| ... |
| source_url | text | Link to run on provider (MVP: GitHub Actions URL) |
| started_at | timestamptz | |
| completed_at | timestamptz | null if still running |
| duration_ms | int | Computed on completion |
| created_at | timestamptz | |

**Unique:** `(repo_id, external_run_id)`

### `pipeline_jobs`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| run_id | uuid FK | → pipeline_runs |
| external_job_id | text | Provider-native job ID |
| name | text | |
| status | text | queued \| in_progress \| completed |
| conclusion | text | success \| failure \| cancelled \| skipped \| null |
| runner_name | text | nullable |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| duration_ms | int | |

**Unique:** `(run_id, external_job_id)`

### `pipeline_steps`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK | → pipeline_jobs |
| number | int | Step number within job |
| name | text | |
| status | text | queued \| in_progress \| completed |
| conclusion | text | success \| failure \| cancelled \| skipped \| null |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| duration_ms | int | |

**Note on `workspace_id` denormalization:** `integrations`, `repositories`, `pipeline_runs`, and `pipeline_jobs` all carry a denormalized `workspace_id` for fast workspace-scoped queries without deep JOINs (Decision #31). `pipeline_steps` does NOT — steps are only ever loaded in the context of a specific job (run detail page), so the JOIN through `pipeline_jobs` is acceptable there.

---

## 7. API Design

### Principles

- RESTful, versioned under `/api/v1/`
- All routes defined with `@hono/zod-openapi` — schema, validation, and docs in one place
- OpenAPI spec auto-generated at `/api/v1/openapi.json`
- Scalar UI served at `/api/docs` — zero manual doc maintenance
- Full CRUD parity on all resources — no read-only endpoints without corresponding write endpoints
- All endpoints workspace-scoped

### 7.1 Authentication

Two auth modes, both produce a workspace-scoped identity:

**Browser sessions (GitHub OAuth)**
- User signs in via GitHub OAuth → server exchanges code for GitHub user info
- Server issues a signed JWT (short-lived, e.g. 15min) + refresh token (httpOnly cookie, 30d)
- JWT contains: `userId`, `workspaceId`, `role`
- All browser requests send JWT as `Authorization: Bearer <token>`

**API Keys (programmatic access)**
- Owner/Admin generates API key in workspace settings — stored as `sha256(key)` in DB, prefix shown once
- Key sent as `Authorization: Bearer pw_<key>`
- Server detects `pw_` prefix → looks up hash → resolves workspace + permissions
- Keys are workspace-scoped, have optional expiry, can be revoked individually
- Available on all plans including OSS self-hosted

**`api_keys` table:**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK | → workspaces |
| created_by | uuid FK | → users |
| name | text | Human label e.g. "CI pipeline" |
| key_hash | text | sha256 of the actual key — never stored plain |
| key_prefix | text | First 8 chars shown in UI for identification |
| expires_at | timestamptz | null = no expiry |
| last_used_at | timestamptz | Updated on each use |
| revoked_at | timestamptz | null = active |
| created_at | timestamptz | |

### CRUD Parity Matrix

| Resource | GET (list) | GET (single) | POST | PATCH | DELETE |
|---|---|---|---|---|---|
| Workspaces | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workspace Members | ✓ | ✓ | ✓ (invite) | ✓ (role) | ✓ |
| Workspace Invites | ✓ | ✓ | ✓ | — | ✓ (revoke) |
| Integrations | ✓ | ✓ | ✓ | — | ✓ |
| Repositories | ✓ | ✓ | — (auto-synced) | ✓ (settings) | ✓ |
| Pipeline Runs | ✓ | ✓ | — (webhook-driven) | — | ✓ (manual purge) |
| Pipeline Jobs | ✓ | ✓ | — | — | — |
| Pipeline Steps | ✓ | ✓ | — | — | — |
| API Keys | ✓ | ✓ | ✓ | — | ✓ (revoke) |
| Insights | ✓ | — | — | — | — |
| Billing (cloud) | ✓ (current) | — | ✓ (checkout) | ✓ (plan change) | ✓ (cancel) |

Note: Pipeline Jobs/Steps have no DELETE of their own — they cascade-delete with their parent run. API Keys and Invites use DELETE semantically for "revoke".

OpenAPI schemas use vendor-neutral type names (`PipelineRun`, `PipelineJob`, `Integration`). UI copy may say "workflow" where that matches GitHub Actions terminology.

### Example Route Shape

```
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/:workspaceId
PATCH  /api/v1/workspaces/:workspaceId
DELETE /api/v1/workspaces/:workspaceId

GET    /api/v1/workspaces/:workspaceId/integrations
GET    /api/v1/workspaces/:workspaceId/integrations/:integrationId
POST   /api/v1/workspaces/:workspaceId/integrations
DELETE /api/v1/workspaces/:workspaceId/integrations/:integrationId

GET    /api/v1/workspaces/:workspaceId/repositories
GET    /api/v1/workspaces/:workspaceId/repositories/:repoId
PATCH  /api/v1/workspaces/:workspaceId/repositories/:repoId
DELETE /api/v1/workspaces/:workspaceId/repositories/:repoId

GET    /api/v1/workspaces/:workspaceId/repositories/:repoId/runs
GET    /api/v1/workspaces/:workspaceId/repositories/:repoId/runs/:runId
GET    /api/v1/workspaces/:workspaceId/repositories/:repoId/runs/:runId/jobs
GET    /api/v1/workspaces/:workspaceId/repositories/:repoId/runs/:runId/jobs/:jobId/steps

GET    /api/v1/workspaces/:workspaceId/insights

# API Keys (all editions)
GET    /api/v1/workspaces/:workspaceId/api-keys
POST   /api/v1/workspaces/:workspaceId/api-keys
DELETE /api/v1/workspaces/:workspaceId/api-keys/:keyId

# Members & Invites
GET    /api/v1/workspaces/:workspaceId/members
DELETE /api/v1/workspaces/:workspaceId/members/:userId
PATCH  /api/v1/workspaces/:workspaceId/members/:userId
GET    /api/v1/workspaces/:workspaceId/invites
POST   /api/v1/workspaces/:workspaceId/invites
DELETE /api/v1/workspaces/:workspaceId/invites/:inviteId

# SSE (one-time token + stream)
GET    /api/v1/sse-token
GET    /api/v1/workspaces/:workspaceId/repos/:repoId/stream

# Auth (not workspace-scoped)
GET    /auth/github                          # initiate OAuth
GET    /auth/github/callback                 # OAuth callback
POST   /auth/refresh                         # rotate tokens
POST   /auth/logout
POST   /auth/logout-all
POST   /auth/switch-workspace                # issue new JWT for different workspace

# Onboarding
GET    /onboarding/github-callback           # GitHub App install callback

# Invites (public, token-based)
GET    /invite/:token                        # validate + show
POST   /invite/:token/accept

# Webhooks (signed, not authenticated via JWT)
POST   /webhooks/github                       # GitHub App events
POST   /webhooks/stripe                        # Stripe events (cloud only)
POST   /webhooks/postmark                       # Postmark bounce/unsubscribe (cloud only)

# Billing (cloud only)
GET    /api/v1/workspaces/:workspaceId/billing
POST   /api/v1/workspaces/:workspaceId/billing/checkout
POST   /api/v1/workspaces/:workspaceId/billing/portal

# Public (marketing/waitlist — cloud only)
POST   /api/v1/waitlist                       # subscribe (triggers double opt-in)
GET    /api/v1/waitlist/confirm/:token        # confirm subscription
GET    /api/v1/waitlist/unsubscribe/:token    # unsubscribe
```

---

## 8. Pricing

Usage-based rather than seat-based — price scales with what actually matters: how many repos are connected and how much history is retained.

### Plans

| | **Free** | **Pro** | **Business** |
|---|---|---|---|
| **Price** | $0 | $19/mo | $49/mo |
| Workspaces | 1 | 3 | Unlimited |
| Repositories | Up to 10 | Up to 50 | Unlimited |
| Run history retention | 30 days (fixed) | up to 365 days | up to 365 days |
| Team members | 1 (owner only) | Up to 5 | Unlimited |
| Live pipeline view | ✓ | ✓ | ✓ |
| Basic insights | ✓ | ✓ | ✓ |
| Advanced analytics | — | ✓ | ✓ |
| API access + API Keys | ✓ | ✓ | ✓ |
| Webhook Gateway (future) | — | ✓ | ✓ |
| Alerts & Notifications (future) | — | ✓ | ✓ |
| Priority support | — | — | ✓ |
| SSO (future) | — | — | ✓ |

### Rationale

- No per-seat pricing — a team of 10 all looking at the same dashboard shouldn't cost 10x more
- Repos and retention are the actual cost drivers (storage, API calls, webhook volume)
- Free tier is genuinely useful — not crippled — to drive word of mouth
- Self-hosted OSS is always free, no license key required

---

## 9. Observability — Sentry

Full Sentry integration from day one across all services.

| Feature | Where | Notes |
|---|---|---|
| Error tracking | API, Worker, Frontend | Automatic exception capture |
| Performance tracing | API, Worker | Distributed traces across services |
| Source map upload | CI/CD (GitHub Actions) | Upload on every build, map minified errors to source |
| Logs (GA) | API, Worker | Structured log ingestion via Sentry SDK |
| Session replay | Frontend | Capture UI errors in context |
| Release tracking | CI/CD | Tag releases in Sentry on deploy |
| Alerts | Sentry | Error spike, new issue, regression alerts |

Sentry DSN and org/project config managed via Phase. Source map upload token stored as CI secret synced via Phase → GitHub Actions.

---

## 10. Secrets Management — Phase

All secrets are authored in **Phase Cloud** (EU region, Frankfurt/AWS eu-central-1). E2E encrypted — Phase never sees plaintext secrets. SOC 2 Type II certified, GDPR-compatible (see Decision #32).

### Sync model

**Phase → GitHub Actions** is the only sync that originates from Phase. Configured by the operator in Phase Console (not in workflow code). No `phase-action` in pipelines.

**GitHub Actions → Fly.io / CF Workers** happens in workflow code — `sync-secrets.yml` reads `${{ secrets.* }}` from the active GitHub Actions environment and runs `flyctl secrets set` / `wrangler secret put`. There is no Phase→Fly or Phase→CF path.

| Target | How secrets get there |
|---|---|
| **GitHub Actions** | Phase Console native sync → environment **secrets** (`staging`, `production`, `ci`) — all Phase keys, including URLs and slugs |
| **Fly.io** | `sync-secrets.yml` from `staging` or `production` GitHub Actions environment |
| **Cloudflare Workers** | `sync-secrets.yml` from `staging` or `production` GitHub Actions environment |
| **Local dev** | Phase CLI — `phase run --env=Development -- <command>` or `phase secrets export --env=Development > .env` |

### Fly.io secrets staging modes

`sync-secrets.sh` reads `FLY_SECRETS_MODE` from the workflow. Cloudflare Worker secrets are always applied immediately via `wrangler secret put` regardless of mode.

| Mode | Trigger | Behaviour |
|---|---|---|
| **`stage-only`** | `workflow_call` (orchestrator deploy chains) | `flyctl secrets set --stage` — secrets staged on the Fly app but not rolled out to running Machines. The following `flyctl deploy` in the deploy chain applies them. |
| **`stage-and-deploy`** | `workflow_dispatch` (manual operator sync) | `flyctl secrets set --stage` then `flyctl secrets deploy` — staged secrets are deployed to running Machines immediately, without a full app deploy. |

Manual dispatch on `sync-secrets.yml` is the operator escape hatch for secret-only updates (no code deploy).

### Phase environments

Phase app: **`pipewatch`**. Four environments in Phase Console — names are **title case**, not lowercase slugs. **Development** is local-only (no sync). **CI**, **Staging**, and **Production** sync to GitHub Actions.

| Phase environment | Syncs to GitHub Actions | Status | Purpose |
|---|---|---|---|
| Development | — (no sync) | — | Local app dev via Phase CLI; integration tests use ephemeral containers, not Development secrets for DB |
| CI | `ci` | **Provisioned** | CI/test credentials (ReportPortal, Sentry upload, etc.) — no database URLs |
| Staging | `staging` | Pending | Staging deploy runtime secrets |
| Production | `production` | Pending | Production deploy runtime secrets |

Phase Console native sync is configured per pair (e.g. Phase **CI** → GitHub Actions `ci`). To run integration tests locally with ReportPortal: `phase run --env=CI -- pnpm test:integration` (DB/Redis still come from ephemeral containers, not Phase).

### GitHub Actions environments

Three environments. Workflows declare `environment: <name>` to access that environment's secrets.

| Environment | Purpose | Typical contents |
|---|---|---|
| `staging` | Staging deploys (`staging` branch) | All runtime secrets for staging Fly/CF apps (`DATABASE_URL`, `JWT_*`, `GH_*` GitHub App keys, etc.) |
| `production` | Production deploys (release published) | All runtime secrets for production Fly/CF apps |
| `ci` | PR/branch CI — lint gates don't need it; jobs that need credentials do | ReportPortal (`REPORTPORTAL_*`), `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` for source maps on CI builds. **No `DATABASE_URL`** — Postgres, Redis, and other dependencies are ephemeral GHA service containers. **Provisioned** — Phase **CI** ↔ GitHub Actions `ci` sync configured. |

**Phase → GHA sync:** Phase Console syncs **every** key to GitHub Actions as a **secret** — including URLs and project slugs. Workflows reference `${{ secrets.KEY }}` only. Do not use `${{ vars.KEY }}` for Phase-synced values.

**Workflow-managed variables (exception):** `DEPLOYED_VERSION` in `production` — written by the deploy workflow via `gh variable set`; use `${{ vars.DEPLOYED_VERSION }}`.

Deploy workflows (`staging` / `production`) and CI workflows (`ci`) consume `${{ secrets.* }}` only (plus `vars.DEPLOYED_VERSION` where noted) — never fetch from Phase at runtime. Third-party GitHub Actions in workflow YAML are pinned to full commit SHAs. Full variable list in Section 23.

---

## 11. Testing Strategy

Testing is a first-class concern from day one. All test results reported to self-hosted ReportPortal.

### Test Layers

| Layer | Framework | Scope | Reporter |
|---|---|---|---|
| Unit | Vitest | Pure functions, utils, data transforms | ReportPortal via `@reportportal/agent-js-vitest` |
| Integration | Vitest | API routes, DB queries, BullMQ workers (ephemeral Postgres + Redis — CI and local) | ReportPortal via `@reportportal/agent-js-vitest` |
| E2E | Playwright | Full user flows in browser (onboarding, dashboard, run detail) | ReportPortal via `@reportportal/agent-js-playwright` |

### CI Pipeline

High-level overview — full workflow definitions in Section 22 (CI/CD Pipeline). Jobs that need credentials use GitHub Actions environment **`ci`** (secrets synced from Phase — see §10).

```
on: push / pull_request

jobs:
  lint:         turbo lint                    # no environment needed
  unit:         turbo test:unit               # no environment needed
  integration:  environment: ci → turbo test:integration  (ephemeral Postgres + Redis containers)
  e2e:          environment: ci → playwright test       (staging→main PR after CI; manual dispatch)
```

All test jobs that report to ReportPortal read `REPORTPORTAL_URL`, `REPORTPORTAL_API_KEY`, and `REPORTPORTAL_PROJECT` from `${{ secrets.* }}` in the `ci` environment — not hardcoded in workflow YAML.

### Local test runs

```bash
pnpm test:unit              # no containers
pnpm test:integration       # ephemeral Postgres + Redis, random ports, mandatory cleanup
```

Local integration tests use the **same ephemeral-container model as CI** — not a developer's running `docker compose up` stack, not Neon, and no `DATABASE_URL` in Phase **Development**. Optional ReportPortal reporting locally: `phase run --env=CI -- pnpm test:integration`.

### Ephemeral dependencies for integration tests (CI + local)

Integration tests never use Neon or a shared local database. No `DATABASE_URL` in the `ci` GitHub Actions environment, Phase **CI**, or Phase **Development**.

| Service | Container image | Purpose |
|---|---|---|
| PostgreSQL | `postgres:16-alpine` | Drizzle migrations + DB integration tests |
| Redis | `redis:7-alpine` | BullMQ / queue integration tests |

**CI:** GitHub Actions `services:` containers; fixed internal hostnames (`postgres`, `redis`). `DATABASE_URL` / `REDIS_URL` set inline in the workflow.

**Local:** Same images, **random host ports** published (`0` → container port) so parallel runs and other local services never collide. Connection URLs built at runtime from assigned ports.

**Mandatory cleanup (non-negotiable):** Every integration test run — CI job end, local success, local failure, `Ctrl+C`, killed process, or runner timeout — must tear down all containers, volumes, and networks created for that run. Implementation requirements:

- Register cleanup on `EXIT`, `SIGINT`, and `SIGTERM` (shell `trap` or Vitest `globalSetup` / `globalTeardown` with `finally`)
- Stop and remove containers; remove named volumes created for the run
- Use a unique run ID in container/network names (e.g. `pipewatch-test-<uuid>`) to avoid cross-run interference
- After cleanup, prune dangling test resources (e.g. `docker container prune` / `docker volume prune` filtered by test label) so interrupted runs do not leave orphans on the developer machine or CI runner

A failed or aborted test run must never leave Postgres/Redis containers running in the background.

Hosted **staging** and **production** remain on separate Neon projects (Decision #17). Integration tests never touch them.

PR status checks gate on lint + unit + integration (CI, required on PRs). E2E runs on staging→main PRs after CI succeeds (required merge check on `main`). Manual E2E via `e2e.yml` workflow_dispatch.

---

## 12. MVP Feature Scope

### 12.1 GitHub App Installation Flow

Implemented as part of the Onboarding Wizard (see Section 13). Summary:

- User creates workspace (wizard step 1) → installs GitHub App (wizard step 2)
- GitHub redirects back with `installation_id` to `/onboarding/github-callback`
- PipeWatch exchanges for installation token, creates `integrations` row (`provider = 'github'`), discovers repos
- User selects repos to track (wizard step 3) → backfill jobs enqueued
- Backfill fetches run history per repo (default 30d, configurable per plan)
- User lands on workspace dashboard — data populates as backfill completes

### 12.2 Dashboard — Multi-Repo Overview

- All repos in workspace in one view, sortable by last run, failure rate, name
- Per-repo: last run status, workflow count, recent failure rate
- Global health bar — how many repos are currently green / failing / running
- Live updates via SSE — no page refresh needed

### 12.3 Workflow Run List

- Per-repo list of runs, paginated, filterable by branch / workflow / status / trigger
- Columns: workflow name, branch, trigger, actor, status, duration, started at
- Live status updates for in-progress runs
- Click-through to run detail

### 12.4 Run Detail — Job & Step Drill-Down

- Visual job graph (sequential and parallel jobs)
- Per-job: status, duration, runner
- Per-step: status and duration within each job
- Failed steps highlighted prominently
- "View on GitHub" link via `pipeline_runs.source_url` (no log storage in MVP)

### 12.5 Basic Insights

- Time range toggle: 7d / 30d (date picker post-MVP — see Decision #19)
- Per-workflow: average duration over time
- Per-workflow: failure rate over time
- Slowest workflows across all repos in workspace
- Most failing workflows across all repos in workspace
- Summary cards: total runs, success rate, avg duration, most active repo
- Simple time-series charts — no complex analytics for MVP

### 12.6 Webhook Receiver

- Endpoint: `POST /webhooks/github`
- Validate `X-Hub-Signature-256` before any processing (`timingSafeEqual`)
- Reject invalid signatures with 401 — no processing, no payload logging
- Enqueue valid events to BullMQ for async processing
- Return 200 immediately after enqueue (GitHub expects fast ack)
- Handle: `workflow_run` (created, in_progress, completed) and `workflow_job` (queued, in_progress, completed)

### 12.7 Auth

Full detail in Section 20 (Auth Flow). Summary:

- GitHub OAuth for browser login (OAuth → JWT access token + stateful refresh token in httpOnly cookie)
- First login → onboarding wizard (Section 13)
- Workspace invite flow: owner/admin sends invite link → recipient signs in → joins with assigned role
- API Keys for programmatic access — workspace-scoped, optional expiry, all editions
- PipeWatch CE: same OAuth flow; single-workspace mode; bootstrap flow (Section 26) if user count = 0

---

## 13. Onboarding Wizard

The onboarding wizard is the first-run experience for both editions. It guides the user from account creation through connecting their first repository. State is tracked in the URL (`?step=N`) for deep-linking and debuggability.

### Wizard Entry Points

| Condition | Entry Point |
|---|---|
| PipeWatch CE, `users` count = 0 | `/setup` → Bootstrap flow → Wizard |
| PipeWatch CE, existing user, new workspace | `/workspaces/new` → Wizard |
| PipeWatch Cloud, first login | After OAuth → `/onboarding?step=1` |
| PipeWatch Cloud, existing user, new workspace | `/workspaces/new?step=1` |

### Steps

#### Step 1 — Create Workspace (`?step=1`)

**Both editions.**

- Input: Workspace name (auto-generates slug, editable)
- CE: plan selector hidden — CE has no plans
- Cloud: plan selector shown (Free default, upgrade prompt)
- CTA: "Create Workspace" → creates workspace in DB → advance to step 2

#### Step 2 — Install GitHub App (`?step=2`)

**Both editions.**

- Explains what the GitHub App does and what permissions it requests
- Shows the GitHub App install URL: `https://github.com/apps/pipewatch/installations/new`
- "Install GitHub App" → opens GitHub in new tab (or same tab)
- GitHub redirects back to `/onboarding/github-callback?installation_id=xxx&step=3`
- CE note: if user already has a GitHub App installed, show option to enter `installation_id` manually

#### Step 3 — Repo Selection & Backfill (`?step=3`)

**Both editions.**

- List of repos discovered from the integration (fetched from GitHub API)
- Multi-select: user picks which repos to track (all selected by default)
- CE: no repo limit shown
- Cloud Free: repo limit badge ("You can track up to 10 repos on the Free plan")
- CTA: "Start syncing" → enables selected repos → triggers backfill jobs
- Progress indicator: "Syncing X repos — fetching run history..." (backfill window = plan retention, default 30d)
- "Go to Dashboard" button appears immediately (user doesn't have to wait for backfill)

#### Step 4 — Done (`?step=4`)

**Both editions.**

- Success state: "You're all set"
- Summary: N repos connected, backfill in progress
- Quick tips: "Live updates appear automatically", "Set up polling mode per repo in settings"
- CTA: "Go to Dashboard" → `/workspaces/:slug/`

### Wizard State Persistence

- Step progress stored in URL only — no DB state needed
- If user leaves mid-wizard and returns: resume from last completed step (infer from DB state: workspace exists? → skip step 1; integration exists? → skip step 2)
- Wizard accessible again from dashboard via "Add another org" or "Connect new workspace"

### CE Bootstrap Variant

When entering via `/setup` (user count = 0):

- Step 0 injected before step 1: "Welcome to PipeWatch CE" screen with "Sign in with GitHub" button
- After OAuth + user creation: auto-advance to step 1 (Create Workspace)
- Default workspace name pre-filled as "My Workspace"
- Steps 2–4 identical to standard wizard

---

## 14. Marketing Site

Separate deployment from the app — independent release cycle, no shared infra risk.

### Stack

- Next.js (App Router) deployed to Cloudflare Workers via OpenNext
- Separate Cloudflare Workers project from the dashboard
- Domain: `pipewatch.app` (secured) — CF Worker: `pipewatch-prod-marketing`
- App lives at: `cloud.pipewatch.app`
- Umami analytics (self-hosted, existing MDG Labs instance) — injected into marketing site only, not the app

### MVP Pages

| Page | Purpose |
|---|---|
| `/` | Hero, value prop, feature highlights, pricing table, CTA |
| `/pricing` | Detailed pricing breakdown, plan comparison, FAQ |
| `/docs` | Getting started, self-hosted setup guide, GitHub App setup |
| `/changelog` | Release notes — markdown-driven |
| `/waitlist` | Email capture before launch — Postmark double opt-in, stored in `subscribers` table |

### Waitlist & Newsletter

- Email capture form on the marketing site
- Emails stored in a `subscribers` table in Neon (shared across MDG Labs products, own schema)
- Bulk delivery (waitlist launch email, newsletter) via **Postmark Broadcast API** (Broadcast stream) — API call from backend
- Double opt-in: confirmation email sent via Postmark on signup, `confirmed_at` set on click
- Unsubscribe via UUID token — `unsubscribed_at` set, no deletion
- Postmark Bounce + Unsubscribe webhooks handled by two small API endpoints to keep list clean
- On launch: send waitlist announcement via Postmark Broadcast or manual bulk send
- `subscribers` table is product-agnostic — used for future PipeWatch product updates too

**`subscribers` table (shared schema):**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| source | text | `pipewatch_waitlist`, `pipewatch_newsletter`, etc. |
| confirmed_at | timestamptz | null until double opt-in confirmed |
| unsubscribed_at | timestamptz | null if still subscribed |
| unsubscribe_token | uuid unique | Used in unsubscribe links |
| created_at | timestamptz | |

### Pre-Launch Mode

The marketing site ships before the app is ready. In pre-launch mode:

- All CTAs point to `/waitlist`
- Pricing page visible but "Get started" buttons go to waitlist
- A single env flag (`LAUNCH_MODE=waitlist|live`) switches CTA behavior site-wide

---

## 15. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Webhook processing latency | < 500ms p99 | From receive to DB write |
| Dashboard load time | < 2s | First meaningful paint |
| Backfill performance | ~100 repos in < 5 min | Rate-limit-aware, exponential backoff |
| CE resource usage | < 512MB RAM idle | Reasonable for a VPS |
| CE data retention | 30 days default | Configurable via `RETENTION_DAYS` env var |
| GitHub API rate limit handling | Graceful backoff + retry | Respect `X-RateLimit-Remaining` |
| Webhook signature validation | Always enforced, no bypass | Security non-negotiable |
| All API routes workspace-scoped | 100% | No cross-workspace data leakage possible |

---

## 16. PipeWatch CE Setup (Target UX)

Goal: sub-10-minute setup for a technical user. Applies to PipeWatch CE only.

**Step 1 — Create a GitHub App**

- Set Webhook URL to your PipeWatch instance (`https://pipewatch.yourdomain.com/webhooks/github`)
- Set Webhook Secret — copy into PipeWatch config
- Required permissions: Actions (read), Metadata (read)
- Subscribe to events: `workflow_run`, `workflow_job`

**Step 2 — Run PipeWatch**

- `docker compose up -d` — ships with PostgreSQL and Redis included
- Set env vars: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- Visit `http://localhost:3000`, create workspace, install the GitHub App, done

**Migrations (CE):** Run automatically at API startup via the entrypoint script before the server process starts. No manual intervention needed — including on upgrades. Uses the standard `DATABASE_URL` (pooled or direct, both work for Drizzle migrations in CE since there's no Neon pooler involved).

**Step 3 — Expose webhook endpoint (if not already public)**

- Option A: Server is already public — nothing to do
- Option B: Cloudflare Tunnel — `cloudflared tunnel --url http://localhost:3000` (one command)
- Option C: Enable polling mode — set `PIPEWATCH_MODE=polling`, no public endpoint needed

---

## 17. Monorepo Structure

pnpm workspaces + Turborepo. Single GitHub repo: `mdg-labs/pipewatch`.

```
pipewatch/
├── apps/
│   ├── api/          # Hono API + Webhook Receiver (Fly.io: pipewatch-{env}-api)
│   ├── worker/       # BullMQ Worker (Fly.io: pipewatch-{env}-worker)
│   ├── web/          # Next.js Dashboard (CF Worker: pipewatch-{env}-web)
│   └── marketing/    # Next.js Marketing Site (CF Worker: pipewatch-{env}-marketing)
├── packages/
│   ├── db/           # Drizzle schema, migrations, db client
│   │   ├── schema/   # One file per entity (users.ts, integrations.ts, pipeline_runs.ts, etc.)
│   │   ├── migrations/
│   │   └── index.ts  # Exported db client
│   ├── types/        # Shared TypeScript types (API contracts, enums)
│   ├── config/       # Shared ESLint, TypeScript, Tailwind configs
│   └── utils/        # Shared utilities (crypto, date formatting, etc.)
├── scripts/          # test-deps orchestration (ephemeral containers, cleanup traps)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**`turbo.json` pipeline:**
- `build` depends on `^build` (build deps first)
- `test` depends on `^build`
- `dev` runs all in parallel
- `deploy:api`, `deploy:worker`, `deploy:web`, `deploy:marketing` — independent deploy tasks

**Package dependency graph:**
- `apps/api` → `packages/db`, `packages/types`, `packages/utils`
- `apps/worker` → `packages/db`, `packages/types`, `packages/utils`
- `apps/web` → `packages/types`, `packages/utils`
- `apps/marketing` → `packages/utils`

---

## 18. Background Jobs — BullMQ

Three queues, all in `apps/worker`.

| Queue | Priority | Purpose |
|---|---|---|
| `webhook-events` | High | Process incoming GitHub webhook payloads → upsert `pipeline_*` rows |
| `backfill` | Low | Initial history sync on integration connect |
| `polling` | Normal | Repeatable jobs for repos in polling mode |

### Job Types

**`webhook-events` queue:**
- `process-pipeline-run` — parse GitHub `workflow_run` payload, upsert `pipeline_runs` row, trigger SSE broadcast
- `process-pipeline-job` — parse GitHub `workflow_job` payload, upsert `pipeline_jobs` + `pipeline_steps` rows, trigger SSE broadcast

**`backfill` queue:**
- `backfill-integration` — paginated fetch of all repos for an integration
- `backfill-repo` — paginated fetch of run history for a single repo (child job)

**`polling` queue:**
- `poll-repo` — repeatable job per repo; fetches latest runs since `last_synced_at`; job name: `poll:${repoId}`; interval from `repositories.polling_interval_seconds`

**`maintenance` queue (internal, low priority):**
- `retention-cleanup` — daily repeatable at 03:00 UTC; deletes runs older than `retention_days` per repo in batches of 1000

### Retry Strategy
- `webhook-events`: 3 retries, exponential backoff (1s, 5s, 30s)
- `backfill`: 5 retries, exponential backoff (5s, 30s, 2m, 10m, 30m)
- `polling`: 3 retries, exponential backoff; on final failure: log to Sentry, skip until next interval
- On permanent failure: move to BullMQ Dead Letter Queue, alert via Sentry

### Polling Mode — Lifecycle
- Repo switched to polling: `queue.add('poll-repo', payload, { repeat: { every: intervalMs } })`
- Repo switched back to webhook: `queue.removeRepeatable('poll-repo', repeatOpts)`
- Repo disabled: remove repeatable job
- Backfill uses `last_synced_at` as cursor — safe to resume after interruption

---

## 19. SSE — Real-Time Updates

### Endpoint

```
GET /api/v1/workspaces/:workspaceId/repos/:repoId/stream
```

One SSE connection per visible repo. Client opens connection when repo page is active, closes on navigation away.

**Auth over SSE:** JWT passed as `Authorization: Bearer <token>` header (standard fetch EventSource polyfill required — native `EventSource` doesn't support headers). Alternative: short-lived one-time SSE token (`GET /api/v1/sse-token` → returns 60s token → passed as `?token=xxx` query param). **Decision: use query param token** (avoids EventSource polyfill requirement, simpler client code).

### SSE Token Flow
1. Client calls `GET /api/v1/sse-token` (authenticated via JWT cookie)
2. Server returns `{ token: "xxx", expiresIn: 60 }` — token stored in Redis with 60s TTL
3. Client opens `EventSource("/api/v1/.../stream?token=xxx")`
4. Server validates token from Redis on connect, deletes it (one-time use)

### Event Types

```typescript
type SSEEvent =
  | { type: 'run:created';    data: PipelineRunSummary }
  | { type: 'run:updated';    data: PipelineRunSummary }
  | { type: 'run:completed';  data: PipelineRunSummary }
  | { type: 'job:updated';    data: PipelineJobSummary }
  | { type: 'heartbeat';      data: { ts: number } }  // every 30s to keep connection alive
```

---

## 20. Auth Flow — Detail

### GitHub OAuth Flow

```
1. GET  /auth/github                         → redirect to GitHub OAuth with state (signed cookie)
2. GET  /auth/github/callback?code=&state=  → validate state, exchange code for user info
3. Upsert user in DB (by github_id)
4. Issue JWT (15min) + refresh token (30d, stored hashed in refresh_tokens table)
5. Set refresh token as httpOnly Secure SameSite=Strict cookie
6. Redirect → /onboarding/create-workspace (new user) or last workspace dashboard (returning)
```

### JWT Payload
```typescript
{
  sub: string        // userId
  workspaceId: string
  role: 'owner' | 'admin' | 'member'
  iat: number
  exp: number        // 15 min
}
```

Note: workspaceId in JWT is the *active* workspace context. Multi-workspace users switch context via `POST /auth/switch-workspace` which issues a new JWT.

### Refresh Token Rotation
- Client calls `POST /auth/refresh` with refresh token cookie
- Server: validate token hash exists + not revoked + not expired
- Server: revoke old token (set `revoked_at`), issue new JWT + new refresh token
- Old refresh token immediately invalid — rotation prevents replay attacks

### Logout
- `POST /auth/logout` — revokes current refresh token
- `POST /auth/logout-all` — revokes all refresh tokens for user

### Invite Flow
```
1. Admin sends invite → POST /api/v1/workspaces/:id/members (creates workspace_invites row)
2. Email sent via SMTP with link: https://cloud.pipewatch.app/invite/:token
3. Recipient visits /invite/:token → if not logged in: redirect to /sign-in?next=/invite/:token
4. After login: GET /invite/:token → validate token (not expired, not accepted)
5. POST /invite/:token/accept → creates workspace_members row, sets accepted_at
6. Redirect to workspace dashboard
```

---

## 21. Email Architecture

Two separate email paths — different transport per use case.

| Type | Transport | Service | Self-hosted |
|---|---|---|---|
| Transactional (invite, password-less link, notifications) | SMTP | Any SMTP server; PipeWatch Cloud uses dedicated Postmark SMTP sender | User configures `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Bulk (waitlist, newsletter, announcements) | Postmark Broadcast API | Postmark Broadcast stream | Not applicable — cloud-only feature |

### Transactional Email Templates (MVP)
- Workspace invite
- Welcome email (on first login)
- Waitlist confirmation (double opt-in)

### Env Vars (transactional)
```
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<postmark-smtp-token>
SMTP_PASS=<postmark-smtp-token>
SMTP_FROM=noreply@pipewatch.app
```

### Self-hosted note
PipeWatch CE users set their own SMTP credentials. Any SMTP-compatible provider works (Postmark, Resend, Mailgun, self-hosted Postfix, etc.). If `SMTP_HOST` is not set, email features are disabled gracefully — invite links shown in UI instead of sent.

---

## 22. CI/CD Pipeline

### Overview

All deployments go through GitHub Actions. Phase is the operator's secret store. The **only** Phase sync is Phase Console → GitHub Actions environments (`staging`, `production`, `ci`). Fly.io and CF Workers receive secrets from workflow code (`sync-secrets.yml`), reading from the `staging` or `production` GitHub Actions environment — never from Phase directly (Decision #33).

Infrastructure resource names use the `prod` slug for production (see §4.3).

Third-party GitHub Actions are pinned to full commit SHAs (tag noted in comment) — no mutable version tags or branch refs.

**Workflow structure** (Decision #34) — **flat layout, nine files**:

```
.github/workflows/
├── orchestrator.yml              # Sole automated entry — push, PR, release published
├── ci.yml                        # Reusable CI gate (workflow_call only)
├── version-check.yml             # Reusable workspace semver validation (workflow_call only)
├── e2e.yml                       # Reusable Playwright E2E (workflow_call + workflow_dispatch)
├── prepare-release.yml           # Reusable draft release + tag (workflow_call only)
├── sync-secrets.yml              # Reusable secret sync (workflow_call + workflow_dispatch)
├── deploy-staging.yml            # Reusable staging deploy chain (workflow_call only)
├── deploy-production.yml         # Reusable production deploy chain (workflow_call only)
└── build-and-push-ce-image.yml   # Reusable CE Docker images to GHCR (workflow_call only)
```

**Entry points:**

| Trigger | Workflow | Notes |
|---|---|---|
| Push / PR / release published | `orchestrator.yml` | **Only** workflow with `on: push`, `on: pull_request`, or `on: release` |
| Manual dispatch | `sync-secrets.yml` | Secrets only — operator escape hatch (`stage-and-deploy` Fly mode) |
| Manual dispatch | `e2e.yml` | On-demand E2E against staging or ephemeral CE stack |

**Caller rule:** Only `orchestrator.yml` invokes reusable workflows via `uses:` for automated CI/CD. `sync-secrets.yml` and `e2e.yml` additionally expose `workflow_dispatch` for manual runs (their job definitions are shared with `workflow_call`).

Per-service deploy logic lives **inside** `deploy-staging.yml` and `deploy-production.yml` as parallel jobs — not as separate reusable workflow files.

All orchestrator calling jobs grant minimum required `permissions` (typically `contents: read`; `packages: write` for CE image builds; `contents: write` for release prep; `actions: write` to record `DEPLOYED_VERSION`).

---

### Trigger Logic (Decision #35)

```
orchestrator.yml — sole automated entry (on: push, pull_request, release published)

Pull request (any branch)
  ci → version-check

Pull request (staging → main)
  ci → e2e (required, after CI)

Push to staging
  ci → sync-secrets (staging, stage-only) → deploy-staging
  ci → build-and-push-ce-image (parallel with deploy chain; no migration dependency)

Push to main
  ci → prepare-release
  ci → build-and-push-ce-image (parallel with prepare-release)

Release published
  sync-secrets (production, stage-only) → deploy-production
  build-and-push-ce-image (parallel with deploy chain; no migration dependency)

Manual dispatch
  sync-secrets.yml  — secrets only (stage-and-deploy Fly mode)
  e2e.yml           — on-demand E2E
```

PR gates: lint + typecheck + unit + build + integration + audit must pass (CI, required on PRs). E2E is required on staging→main PRs after CI succeeds (merge check on `main`). Manual E2E via `e2e.yml` workflow_dispatch.

---

### `orchestrator.yml` — Sole automated entry

```yaml
on:
  push:
  pull_request:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  ci:
    if: github.event_name != 'release'
    permissions:
      contents: read
      pull-requests: write   # ReportPortal PR comments
    uses: ./.github/workflows/ci.yml
    secrets: inherit

  version-check:
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/version-check.yml

  sync-secrets-staging:
    if: push to staging
    needs: [ci]
    uses: ./.github/workflows/sync-secrets.yml
    with:
      environment: staging    # FLY_SECRETS_MODE: stage-only

  deploy-staging:
    if: push to staging
    needs: [sync-secrets-staging]
    uses: ./.github/workflows/deploy-staging.yml
    secrets: inherit

  build-ce-staging:
    if: push to staging
    needs: [ci, meta]   # parallel with deploy-staging chain
    permissions:
      packages: write
    uses: ./.github/workflows/build-and-push-ce-image.yml
    with:
      tags: |
        dev
        nightly
        ${{ needs.meta.outputs.short_sha }}

  prepare-release:
    if: push to main
    needs: [ci]
    permissions:
      contents: write
    uses: ./.github/workflows/prepare-release.yml
    secrets: inherit

  build-ce-main:
    if: push to main
    needs: [ci, meta]
    permissions:
      packages: write
    uses: ./.github/workflows/build-and-push-ce-image.yml
    with:
      tags: |
        latest
        ${{ needs.meta.outputs.short_sha }}
        main

  sync-secrets-production:
    if: github.event_name == 'release'
    uses: ./.github/workflows/sync-secrets.yml
    with:
      environment: production   # FLY_SECRETS_MODE: stage-only

  deploy-production:
    if: release
    needs: [sync-secrets-production]
    permissions:
      actions: write
    uses: ./.github/workflows/deploy-production.yml
    with:
      release_tag: ${{ github.event.release.tag_name }}
    secrets: inherit

  build-ce-release:
    if: release
    permissions:
      packages: write
    uses: ./.github/workflows/build-and-push-ce-image.yml
    with:
      tags: |
        latest
        ${{ github.event.release.tag_name }}

  e2e:
    if: ci passed && PR base main && PR head staging
    needs: [ci]
    permissions:
      pull-requests: write
    uses: ./.github/workflows/e2e.yml
    with:
      advisory: false
    secrets: inherit
```

---

### `ci.yml` — Reusable CI gate (`workflow_call` only)

Never triggered directly. Consolidates lint, typecheck, unit tests, build, integration tests (ephemeral Postgres + Redis service containers), dependency audit, and ReportPortal launch lifecycle.

```yaml
on:
  workflow_call:

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    environment: ci   # ReportPortal, Sentry — not DATABASE_URL (ephemeral containers)
    # ... lint → typecheck → unit → build → integration → audit

  reportportal-summary:
    needs: ci
    environment: ci
    permissions:
      contents: read
      pull-requests: write
    # ... job summary + PR comment
```

---

### `deploy-staging.yml` — Staging deploy chain

Called from `orchestrator.yml` after `sync-secrets-staging` succeeds on push to `staging`. Secrets are already staged on Fly apps (`stage-only`); `flyctl deploy` in each deploy job applies them.

Job chain: **migrate → derive Sentry release → parallel deploys (api, worker, web, marketing) → smoke**.

Deploy jobs are inline in this workflow — not separate reusable workflow files.

### `deploy-production.yml` — Production deploy chain

Called from `orchestrator.yml` on `release: published`, after `sync-secrets-production` succeeds. Skips deploy when release tag matches `DEPLOYED_VERSION` var in the `production` GitHub Actions environment.

Job chain: **check-not-deployed → migrate → derive Sentry release → parallel deploys (api, worker, web, marketing) → smoke → record DEPLOYED_VERSION**.

Outputs `deployed: true` when a new production deploy completed and `DEPLOYED_VERSION` was recorded. CE image builds run in parallel and do not consume this output.

```yaml
on:
  workflow_call:
    inputs:
      release_tag:
        type: string
        required: true
    outputs:
      deployed:
        value: ${{ jobs.record-deployed-version.result == 'success' }}

permissions:
  contents: read

jobs:
  check-not-deployed:
    environment: production
    # compares inputs.release_tag to vars.DEPLOYED_VERSION

  migrate-production:
    needs: check-not-deployed
    if: should_deploy
    environment: production
    # ... run-migrate.sh with DATABASE_URL_UNPOOLED

  # derive-sentry-release → deploy-api/worker/web/marketing (parallel) → smoke

  record-deployed-version:
    permissions:
      actions: write
    # gh variable set DEPLOYED_VERSION
```

Publishing the draft release (created by `prepare-release.yml` on push to `main`) triggers orchestrator → `sync-secrets-production` → this workflow.

---

### `sync-secrets.yml` — Reusable secret sync

Called from `orchestrator.yml` before deploy chains (`sync-secrets-staging`, `sync-secrets-production`). Also callable via `workflow_dispatch` for operator secret-only syncs.

```yaml
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true   # staging | production
      services:
        type: string
        default: all     # or comma-separated: api,worker,web,marketing
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        required: true
      services:
        type: string
        default: all

permissions:
  contents: read

jobs:
  sync:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      # Secrets already in this GitHub Actions environment (synced from Phase Console).
      # Push them to Fly.io and CF Workers — does NOT fetch from Phase at runtime.
      - uses: superfly/flyctl-actions/setup-flyctl@<sha> # pinned
      - env:
          FLY_SECRETS_MODE: ${{ github.event_name == 'workflow_dispatch' && 'stage-and-deploy' || 'stage-only' }}
        run: bash .github/scripts/sync-secrets.sh "${{ inputs.environment }}" "${{ inputs.services }}"
```

**Fly.io modes** (see §10): `stage-only` when called from orchestrator (secrets applied on next `flyctl deploy`); `stage-and-deploy` on manual dispatch (secrets rolled out to running Machines immediately).

---

### Version Check + Auto-tag

**PR validation:** `version-check.yml` (called from orchestrator on PRs) ensures all workspace `package.json` files share the root semver.

**Release preparation:** `prepare-release.yml` (called from orchestrator on push to `main`, after CI) creates a draft GitHub Release + git tag when version ≥ 1.0.0 and `v{version}` does not exist. Operator publishes the draft → triggers `deploy-production.yml`.

---

### CE Docker Images (`build-and-push-ce-image.yml`)

Builds three images (`pipewatch-api`, `pipewatch-worker`, `pipewatch-web`) to GHCR. No app secrets baked in — CE users provide env at runtime via Docker Compose. Orchestrator starts CE builds after CI on `staging`/`main`, or immediately on release publish — **in parallel** with cloud deploy chains (no migration or hosted-infra dependency).

| Trigger | Tags (per image) |
|---|---|
| Push to `staging` (orchestrator) | `dev`, `nightly`, `{short_sha}` |
| Push to `main` (orchestrator) | `latest`, `{short_sha}`, `main` |
| Release published (orchestrator) | `latest`, `{release_tag}` |

```yaml
on:
  workflow_call:
    inputs:
      tags:
        type: string
        required: true   # newline-separated suffixes

permissions:
  contents: read
  packages: write
```

---

### Migrations — Cloud (Hosted Edition)

Migrations run as a dedicated step in deploy workflows **before** any `flyctl deploy` or `wrangler deploy` call. Uses the **unpooled Neon connection URL** — Drizzle Kit migrations require a direct connection, not a pooled one (PgBouncer/Neon pooler breaks DDL transactions).

```yaml
# Part of deploy-staging.yml / deploy-production.yml, before deploy jobs
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@<sha> # pinned
      - uses: ./.github/actions/setup
      - name: Run migrations
        run: bash .github/scripts/run-migrate.sh
        env:
          DATABASE_URL_UNPOOLED: ${{ secrets.DATABASE_URL_UNPOOLED }}
```

**`DATABASE_URL_UNPOOLED`** lives in `staging` and `production` GitHub Actions environments only. Migration failure blocks all deploy jobs in the chain.

---

### Summary: What gets deployed when

| Trigger | CI | Secrets Sync | Deploy | CE Image Tags (per service) | E2E |
|---|---|---|---|---|---|
| Pull request (any branch) | ✓ | — | — | — | — |
| Pull request (staging → main) | ✓ | — | — | — | required (after CI) |
| Push to `staging` | ✓ | ✓ (staging, stage-only) | staging all services | `dev`, `nightly`, `{short_sha}` (parallel with deploy) | — |
| Push to `main` | ✓ + draft release if version ≥ 1.0.0 | — | — | `latest`, `{short_sha}`, `main` | — |
| Release published | — | ✓ (production, stage-only) | production all services (if not already deployed) | `latest`, `{release_tag}` (parallel with deploy) | — |
| Manual `sync-secrets` dispatch | — | ✓ (chosen env, stage-and-deploy) | none | — | — |
| Manual `e2e` dispatch | — | — | none | — | on-demand |

## 23. Environment Variables — Complete Reference

All secrets are authored in Phase Cloud (EU). Phase Console syncs **Staging**, **Production**, and **CI** to matching GitHub Actions environments. **Development** is Phase-only (local CLI). Workflows push `staging` / `production` secrets to Fly/CF via `sync-secrets.yml`. See Section 10.

**GitHub App credential naming:** Phase and GitHub Actions store GitHub App values under **`GH_*`** keys (shorter storage prefix). Fly.io, Cloudflare Workers, CE Docker Compose, and application code use **`GITHUB_*`** runtime names. `sync-secrets.sh` maps `GH_*` → `GITHUB_*` before `flyctl secrets set`; CE and local dev set `GITHUB_*` directly in `.env`.

**Sync-secrets manifest:** `packages/config/sync-secrets-manifest.ts` is the single source of truth for which secrets each hosted service receives, Phase/GHA storage key names (`GH_*` vs runtime `GITHUB_*`), and derived values. `scripts/validate-sync-secrets-manifest.ts` runs in CI to assert the manifest stays aligned with `env.ts` strict fields, `.github/workflows/sync-secrets.yml`, and `.github/scripts/sync-secrets.sh`. `sync-secrets.sh` fails preflight with named missing keys when a required GHA secret is empty — no silent skip.

**Derived `REDIS_URL` (hosted cloud):** Not stored in Phase or GitHub Actions. `sync-secrets.sh` auto-derives `redis://pipewatch-{staging|prod}-redis.internal:6379` from the Fly Redis app name (internal 6PN DNS). The manifest marks `REDIS_URL` as `derived` for api/worker; remove `REDIS_URL` from Phase Staging/Production if still present.

| Phase / GHA storage | Fly / runtime |
|---|---|
| `GH_APP_ID` | `GITHUB_APP_ID` |
| `GH_APP_PRIVATE_KEY` | `GITHUB_APP_PRIVATE_KEY` |
| `GH_WEBHOOK_SECRET` | `GITHUB_WEBHOOK_SECRET` |
| `GH_CLIENT_ID` | `GITHUB_CLIENT_ID` |
| `GH_CLIENT_SECRET` | `GITHUB_CLIENT_SECRET` |
| `GH_APP_SLUG` | `GITHUB_APP_SLUG` |

**GitHub Actions environment column** — which environment holds each value after Phase sync:

| Variable | GHA environment | Services | Notes |
|---|---|---|---|
| `PIPEWATCH_EDITION` | staging, production | all | `ce` \| `cloud` — drives all feature flags (see Section 25) |
| `DATABASE_URL` | staging, production | api, worker | Neon PostgreSQL pooled connection string (runtime) |
| `DATABASE_URL_UNPOOLED` | staging, production | deploy migrations | Neon direct connection — required for Drizzle Kit DDL at deploy time; not used in CI |
| `REDIS_URL` | — (derived) | api, worker | **Derived at sync** — `redis://pipewatch-{staging\|prod}-redis.internal:6379`; not in Phase/GHA |
| `JWT_SECRET` | staging, production | api | HS256 signing secret for access tokens |
| `JWT_REFRESH_SECRET` | staging, production | api | Separate secret for refresh tokens |
| `ENCRYPTION_KEY` | staging, production | api, worker | AES-256-GCM key for encrypting sensitive values at rest (e.g. integration tokens); min 32 chars |
| `GH_APP_ID` | staging, production | api, worker | GitHub App numeric ID — runtime: `GITHUB_APP_ID` |
| `GH_APP_PRIVATE_KEY` | staging, production | api, worker | PEM key (base64 encoded in Phase) — runtime: `GITHUB_APP_PRIVATE_KEY` |
| `GH_WEBHOOK_SECRET` | staging, production | api | For HMAC-SHA256 signature validation — runtime: `GITHUB_WEBHOOK_SECRET` |
| `GH_CLIENT_ID` | staging, production | api | For OAuth flow — runtime: `GITHUB_CLIENT_ID` |
| `GH_CLIENT_SECRET` | staging, production | api | For OAuth flow — runtime: `GITHUB_CLIENT_SECRET` |
| `GH_APP_SLUG` | staging, production | api | e.g. `pipewatch` — install URL — runtime: `GITHUB_APP_SLUG` |
| `SMTP_HOST` | staging, production | api | Postmark SMTP (cloud) or user-configured (self-hosted) |
| `SMTP_PORT` | staging, production | api | 587 |
| `SMTP_USER` | staging, production | api | Postmark SMTP token |
| `SMTP_PASS` | staging, production | api | Postmark SMTP token |
| `SMTP_FROM` | staging, production | api | `noreply@pipewatch.app` |
| `POSTMARK_API_KEY` | staging, production | api | Broadcast stream only — bulk/newsletter sends |
| `POSTMARK_BROADCAST_STREAM` | staging, production | api | Postmark Message Stream ID for broadcast |
| `POSTMARK_WEBHOOK_SECRET` | staging, production | api | For Postmark `X-Postmark-Signature` HMAC validation |
| `STRIPE_SECRET_KEY` | staging, production | api | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | staging, production | api | For Stripe webhook signature validation |
| `STRIPE_PRICE_PRO` | staging, production | api | Stripe Price ID for Pro plan |
| `STRIPE_PRICE_BUSINESS` | staging, production | api | Stripe Price ID for Business plan |
| `SENTRY_DSN` | staging, production | api, worker, web, marketing | Per-service DSN from Sentry |
| `SENTRY_AUTH_TOKEN` | ci | CI builds | Source map upload |
| `SENTRY_ORG` | ci | CI builds | Sentry org slug |
| `SENTRY_PROJECT` | ci (secret) | CI builds | Sentry project slug |
| `REPORTPORTAL_URL` | ci (secret) | CI test jobs | e.g. `https://reportportal.mdg-labs.dev` |
| `REPORTPORTAL_API_KEY` | ci (secret) | CI test jobs | ReportPortal API key |
| `REPORTPORTAL_PROJECT` | ci (secret) | CI test jobs | ReportPortal project name |
| `FLY_API_TOKEN` | staging, production | deploy workflows | Fly.io deploy + `flyctl secrets set` |
| `CF_API_TOKEN` | staging, production | deploy workflows | Cloudflare Workers deploy + `wrangler secret put` |
| `CF_ACCOUNT_ID` | staging, production | deploy workflows | Cloudflare account ID for Wrangler (`CLOUDFLARE_ACCOUNT_ID`) |
| `APP_URL` | staging, production | api | `https://cloud.pipewatch.app` (staging: `https://staging-cloud.pipewatch.app`) |
| `MARKETING_URL` | staging, production | api | `https://pipewatch.app` |
| `PUBLIC_API_URL` | staging, production | api | Public API origin for OAuth callbacks — runtime key; Phase/GHA storage: `NEXT_PUBLIC_API_URL` (same value as web). Staging: `https://staging-api.pipewatch.app`; production: `https://api.pipewatch.app` |
| `NODE_ENV` | staging, production | all | `development` \| `staging` \| `production` |
| `UMAMI_SCRIPT_URL` | staging, production | marketing | Self-hosted Umami script URL |
| `UMAMI_WEBSITE_ID` | staging, production | marketing | PipeWatch-specific site ID in Umami |
| `PIPEWATCH_MODE` | staging, production | api, worker | `webhook` (default) \| `polling` — CE self-hosted global override: use polling when no public webhook endpoint; per-repo interval still from `polling_interval_seconds` (default 60s when unset in polling mode) |
| `RETENTION_DAYS` | staging, production | worker | Self-hosted default retention override (default: 30) |
| `LAUNCH_MODE` | staging, production | marketing | `waitlist` \| `live` — controls CTA behaviour |
| `NEXT_PUBLIC_APP_URL` | staging, production | marketing | Cloud app origin for Sign in / Get started CTA links (`https://cloud.pipewatch.app`; staging: `https://staging-cloud.pipewatch.app`) |

---

## 24. Stripe Integration

Reuses the Stripe stack established for InboxOps (same MDG Labs Stripe account, separate Products).

### Stripe Setup Checklist (manual, pre-launch)
- [ ] Create Product: "PipeWatch Pro" → Price: $19/mo recurring → note `price_id` → set as `STRIPE_PRICE_PRO`
- [ ] Create Product: "PipeWatch Business" → Price: $49/mo recurring → note `price_id` → set as `STRIPE_PRICE_BUSINESS`
- [ ] Configure Stripe Tax for EU (already enabled for InboxOps — verify PipeWatch products inherit)
- [ ] Add Webhook endpoint: `https://api.pipewatch.app/webhooks/stripe` → select events below
- [ ] Note Webhook signing secret → set as `STRIPE_WEBHOOK_SECRET`

### Handled Stripe Webhook Events

| Event | Action |
|---|---|
| `customer.subscription.created` | Set `workspaces.plan` to matching plan, store `stripe_subscription_id` |
| `customer.subscription.updated` | Sync plan change (upgrade/downgrade) |
| `customer.subscription.deleted` | Downgrade workspace to `free`, clear `stripe_subscription_id` |
| `invoice.payment_failed` | (Post-MVP) Notify workspace owner via email |
| `checkout.session.completed` | Confirm subscription activation |

### Plan Enforcement Points
- Repo add: check `COUNT(repos) < plan.repo_limit` → 403 if exceeded
- Workspace creation: check `COUNT(workspaces for user) < plan.workspace_limit`
- API key creation: check `plan IN ('pro', 'business')` — OSS self-hosted always allowed
- Retention: `MIN(retention_days, plan.max_retention_days)` applied at cleanup job

---

## 25. Docker Compose — PipeWatch CE

```yaml
# docker-compose.yml
services:
  api:
    image: ghcr.io/mdg-labs/pipewatch-api:latest
    ports: ["3000:3000"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://pipewatch:pipewatch@postgres:5432/pipewatch
      REDIS_URL: redis://redis:6379
      PIPEWATCH_MODE: ${PIPEWATCH_MODE:-webhook}
      RETENTION_DAYS: ${RETENTION_DAYS:-30}
      # GitHub App
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_PRIVATE_KEY: ${GITHUB_APP_PRIVATE_KEY}
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      GITHUB_APP_SLUG: ${GITHUB_APP_SLUG}
      # Auth
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      APP_URL: ${APP_URL:-http://localhost:3000}
      # Email (optional — features degrade gracefully if not set)
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASS: ${SMTP_PASS:-}
      SMTP_FROM: ${SMTP_FROM:-noreply@example.com}
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped

  worker:
    image: ghcr.io/mdg-labs/pipewatch-worker:latest
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://pipewatch:pipewatch@postgres:5432/pipewatch
      REDIS_URL: redis://redis:6379
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_PRIVATE_KEY: ${GITHUB_APP_PRIVATE_KEY}
      RETENTION_DAYS: ${RETENTION_DAYS:-30}
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped

  web:
    image: ghcr.io/mdg-labs/pipewatch-web:latest
    ports: ["3001:3001"]
    environment:
      NEXT_PUBLIC_API_URL: ${APP_URL:-http://localhost:3000}
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pipewatch
      POSTGRES_USER: pipewatch
      POSTGRES_PASSWORD: pipewatch
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pipewatch"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

Self-hosted users copy `.env.example` → `.env`, fill in GitHub App credentials and JWT secrets, then `docker compose up -d`.

---

## 26. Edition System — `PIPEWATCH_EDITION`

A single environment variable drives all runtime behaviour differences between editions. No manual feature flag configuration needed.

```
PIPEWATCH_EDITION=ce      # PipeWatch Community Edition (self-hosted)
PIPEWATCH_EDITION=cloud   # PipeWatch Cloud (managed)
```

### Derived Feature Flags

All flags below are **automatically derived** from `PIPEWATCH_EDITION` at startup. Never set these manually.

| Flag | CE | Cloud | Notes |
|---|---|---|---|
| `BILLING_ENABLED` | false | true | Stripe Checkout, plan enforcement |
| `PLAN_LIMITS_ENABLED` | false | true | Repo caps, workspace caps, retention ceiling |
| `WAITLIST_ENABLED` | false | true | `/waitlist` route + Postmark Broadcast |
| `NEWSLETTER_ENABLED` | false | true | Postmark Broadcast API bulk sends |
| `MULTI_WORKSPACE_ENABLED` | false | true | CE locked to single workspace |
| `BOOTSTRAP_ENABLED` | true | false | `/setup` route active when user count = 0 |
| `UMAMI_ENABLED` | false | true | Injected on marketing site only |
| `STRIPE_ENABLED` | false | true | All Stripe-related code paths |
| `API_KEYS_ENABLED` | true | true | Available on all editions |
| `SSO_ENABLED` | false | false | Post-MVP for both |
| `RETENTION_CEILING` | none | plan-based | CE: no ceiling; Cloud: plan enforces max |

### Implementation Pattern

```typescript
// packages/config/edition.ts
import { z } from 'zod'

const edition = z.enum(['ce', 'cloud']).parse(process.env.PIPEWATCH_EDITION ?? 'ce')

export const flags = {
  BILLING_ENABLED:          edition === 'cloud',
  PLAN_LIMITS_ENABLED:      edition === 'cloud',
  WAITLIST_ENABLED:         edition === 'cloud',
  NEWSLETTER_ENABLED:       edition === 'cloud',
  MULTI_WORKSPACE_ENABLED:  edition === 'cloud',
  BOOTSTRAP_ENABLED:        edition === 'ce',
  STRIPE_ENABLED:           edition === 'cloud',
  API_KEYS_ENABLED:         true,
  SSO_ENABLED:              false,
  RETENTION_CEILING:        edition === 'cloud',
  IS_CE:                    edition === 'ce',
  IS_CLOUD:                 edition === 'cloud',
} as const
```

Used everywhere: `if (flags.BILLING_ENABLED) { ... }`. Full type safety and autocomplete. Dead branches tree-shaken in production builds.

### CE Bootstrap Flow

Triggered when `flags.BOOTSTRAP_ENABLED === true` AND `SELECT COUNT(*) FROM users = 0`.

```
GET /setup   → redirect here from any route if bootstrap condition met
             → "Welcome to PipeWatch CE" screen
             → "Sign in with GitHub to create your admin account"
             → GitHub OAuth → first user created as Owner
             → auto-create default workspace ("My Workspace")
             → redirect to onboarding wizard (/onboarding?step=1)
```

Once user count > 0: `/setup` redirects to `/sign-in` permanently.

---

## 27. Decision Log

Key architectural and product decisions, rationale, and date recorded.

| # | Decision | Rationale | Alternatives Considered | Date |
|---|---|---|---|---|
| 1 | **GitHub App as integration type** | Fine-grained permissions, short-lived installation tokens, org-wide access, webhook support — cleanest integration model | PAT (user-bound, insecure), OAuth App (less control) | Jun 2026 |
| 2 | **Webhooks for realtime, polling as opt-in fallback** | Webhooks are the only path to genuine live pipeline view; polling introduces delay and rate-limit pressure | Polling-only (near-realtime only), GraphQL (no subscription support on GitHub) | Jun 2026 |
| 3 | **No Webhook Gateway for MVP** | Self-hosted users who need webhooks are technical enough to use Cloudflare Tunnel; gateway adds infra complexity pre-launch | Gateway relay as cloud feature (deferred to v1.1) | Jun 2026 |
| 4 | **Webhook signature validation always enforced** | `X-Hub-Signature-256` HMAC-SHA256 + `timingSafeEqual` — no bypass mode, no exceptions; invalid signatures return 401 with no payload processing | Optional validation flag (rejected — security non-negotiable) | Jun 2026 |
| 5 | **SSE over WebSocket for live updates** | Unidirectional push is all PipeWatch needs; SSE is plain HTTP, works through Cloudflare Workers natively, no proxy config, built-in browser reconnect | WebSocket (overkill for MVP, complicates CF Workers deployment) | Jun 2026 |
| 6 | **No log storage — link back to GitHub** | Logs are large (MBs per run), GitHub deletes after 90 days anyway, requires object storage infra; PipeWatch's value is metadata + insights, not log archival | Partial log storage — failed steps only, last N lines (deferred post-MVP if ever) | Jun 2026 |
| 7 | **Retention configurable per repo in UI** | More flexible than account-level settings; `retention_days` on `repositories` table; plan limit acts as ceiling (user can set less but not more than plan allows) | Account-level only (less flexible), env-var only for self-hosted | Jun 2026 |
| 8 | **Polling interval configurable per repo** | Different repos have different activity levels; default 60s, minimum 30s to avoid rate-limit pressure; stored as `polling_interval_seconds` on `repositories` | Global interval only (less flexible), fixed 30s (wasteful for low-activity repos) | Jun 2026 |
| 9 | **GitHub App private for MVP** | Prevents uncontrolled installs before the product is stable; switch to public post-MVP when ready for general availability | Public from day one (risky pre-launch) | Jun 2026 |
| 10 | **Postmark + own `subscribers` table for waitlist/newsletter** | Postmark already in use; own table gives full control, no vendor lock-in, reusable across MDG Labs products; double opt-in + unsubscribe token pattern | Loops.so (extra dependency), plain Neon table without Postmark (no confirmation email) | Jun 2026 |
| 11 | **Workspaces as top-level multi-tenancy unit from day one** | Retrofitting multi-tenancy is painful; all resources workspace-scoped from first migration; self-hosted runs in single-workspace mode | Single-tenant only for MVP, add later (rejected — too costly to retrofit) | Jun 2026 |
| 12 | **Neon PostgreSQL for database** | Serverless Postgres for hosted staging/production; consistent with existing MDG Labs stack. CI integration tests use ephemeral GHA service containers instead (Decision #38) | PlanetScale (MySQL, no Drizzle preference), Supabase (more opinionated), Neon branches for CI (rejected — unnecessary cloud dependency in CI) | Jun 2026 |
| 13 | **Redis on Fly.io for queue/cache** | Cheapest option for MVP; volume-backed Fly app, no managed Redis cost; co-located with API and worker on Fly.io | Upstash (higher cost at scale), Railway Redis | Jun 2026 |
| 14 | **`pipewatch.app` domain** | Secured; `.app` is clean and product-appropriate | `.io`, `.dev` (not available or less preferred) | Jun 2026 |
| 15 | **Umami analytics on marketing site only** | Privacy-friendly, self-hosted on existing MDG Labs instance, zero extra cost; not needed in the app itself | Plausible, Google Analytics (rejected — privacy), Fathom | Jun 2026 |
| 16 | **Code-generated API docs via `@hono/zod-openapi` + Scalar** | Docs are always in sync with implementation — no manual OpenAPI maintenance; Scalar renders better than Swagger UI | Swagger UI (worse DX), manual docs (gets stale immediately) | Jun 2026 |
| 17 | **Separate Neon projects per environment** | Clean isolation between staging and prod; no risk of CI activity affecting prod DB; clearer billing per env | Single project with branches (rejected — branch-level isolation insufficient for prod) | Jun 2026 |
| 18 | **Hard block (403) on repo plan limit** | Clear, predictable behaviour; simpler to implement; avoids ambiguous over-limit states | Soft warning with grace period (rejected) | Jun 2026 |
| 19 | **Fixed 7d/30d toggle for insights MVP** | Simpler to implement; consistent with other time-scoped features having sensible defaults | Date picker from day one (rejected — over-engineering for MVP) | Jun 2026 |
| 20 | **Monorepo with pnpm + Turborepo** | Single repo for all apps; shared types, consistent tooling, one CI pipeline | Multi-repo (rejected — cross-repo type sharing overhead) | Jun 2026 |
| 21 | **Reuse existing Stripe stack from InboxOps** | Already solved Kleinunternehmer VAT, webhook routing, Billing/Tax/Invoicing for Austrian Einzelunternehmen | New Stripe integration (rejected — unnecessary duplication) | Jun 2026 |
| 22 | **Custom JWT auth + API Keys instead of Better Auth** | Better Auth lacks API Key support; custom JWT gives full control; stateful refresh tokens enable logout-all-sessions | Better Auth, Auth.js, Lucia (all evaluated — insufficient API key support) | Jun 2026 |
| 23 | **Stateful refresh tokens** | DB-backed `refresh_tokens` table enables true logout-all-sessions and token revocation; 15min JWT window acceptable | Stateless (simpler but no revocation) | Jun 2026 |
| 24 | **SSE per repo, query-param one-time token** | Per-repo granularity avoids noise; query-param token avoids EventSource polyfill requirement | Per-workspace SSE (too noisy), Authorization header (requires polyfill) | Jun 2026 |
| 25 | **SMTP for transactional, Postmark Broadcast API for bulk** | SMTP is self-hosted compatible (any provider); Broadcast API for waitlist/newsletter is cloud-only; clean separation of concerns | Postmark API for both (not self-hosted friendly), Loops.so (extra vendor) | Jun 2026 |
| 26 | **Free plan: fixed 30d retention; paid plans: 30–365d configurable** | Free users get consistent experience; paid users get flexibility within plan limits; self-hosted has no ceiling | Account-level default only, plan-hardcoded ceiling (less flexible) | Jun 2026 |
| 27 | **API Keys available on all plans including OSS** | Self-hosted users should have full feature parity; API keys drive adoption | Pro+ only (rejected — penalises CE users, contradicts open-core philosophy) | Jun 2026 |
| 28 | **`PIPEWATCH_EDITION` single flag drives all feature flags** | One var → all runtime behaviour derived automatically; no manual flag config; type-safe via `packages/config/edition.ts`; consistent with Ghost, Plausible, Gitea edition patterns | Per-feature env vars (rejected — error-prone, inconsistent) | Jun 2026 |
| 29 | **Onboarding wizard with URL-tracked step state** | URL state enables deep-linking, back-button support, debuggability; step resumption inferred from DB state | DB-persisted wizard state (over-engineered), no wizard (poor UX) | Jun 2026 |
| 30 | **CE bootstrap via GitHub OAuth** | PipeWatch is a developer tool — all CE users have GitHub; avoids password hashing, reset flows; OAuth already implemented | Email+password bootstrap (rejected — extra complexity, more attack surface) | Jun 2026 |
| 33 | **Phase syncs to GitHub Actions only; Fly/CF via workflow code** | Phase Console → GitHub Actions environments (`staging`, `production`, `ci`) is the only Phase sync. `sync-secrets.yml` pushes from GHA env to Fly/CF — no Phase→Fly/CF path, no `phase-action` in workflows. `ci` holds test-tool credentials only (ReportPortal, Sentry upload) — no database URLs. | Hardcoded secrets in YAML (rejected), Phase native push to CF/Fly (rejected), `phase-action` in CI (rejected) | Jun 2026 |
| 34 | **Flat CI/CD layout — orchestrator sole automated entry** | Nine workflow files under `.github/workflows/`. `orchestrator.yml` is the only automated entry (`push`, `pull_request`, `release: published`) and the only caller of reusable workflows for CI/CD. Deploy chains are self-contained (`deploy-staging.yml`, `deploy-production.yml`) with inline per-service jobs — no separate `deploy-api.yml` etc. `sync-secrets.yml` supports `workflow_dispatch` for operator secret-only syncs (`stage-and-deploy` Fly mode). `e2e.yml` supports manual dispatch for on-demand testing. | Per-service reusable deploy workflows (rejected — file sprawl), monolithic single workflow (rejected — unmanageable), standalone production deploy trigger (rejected — orchestrator coordinates full release chain) | Jun 2026 |
| 36 | **CE: auto-migrate at API startup; Cloud: explicit migrate step pre-deploy using unpooled Neon URL** | CE users need zero-friction upgrades — automatic migration on start is the right UX; Cloud needs explicit pre-deploy migration step to avoid deploying new code against old schema; unpooled URL required for Drizzle Kit DDL transactions (pooler breaks DDL) | CE: manual migration CLI (rejected — friction on upgrade), Cloud: migrate inside app startup (rejected — race condition with multiple instances) | Jun 2026 |
| 35 | **Branch-based environment routing + release-gated production deploys** | `staging` branch → staging deploy + nightly CE image; `main` branch → version check → auto-tag + draft release if version >1.0.0 and no existing tag; published release → production deploy + versioned CE image. GitHub Actions environments: `staging` and `production`. Clean separation: staging is always live, production is intentionally gated behind a release publish action. | Auto-deploy main to production (rejected — too risky), manual production deploy only (rejected — too much friction) | Jun 2026 |
| 32 | **Phase over Infisical for secrets management** | Phase: E2E encrypted (server never sees plaintext), SOC 2 Type II, EU/Frankfurt data residency (AWS eu-central-1), native GitHub Actions environment sync (configured in Phase Console); Infisical lacks E2E encryption. GDPR-compatible: subprocessors verified (AWS DE, Cloudflare, Google Workspace US for internal comms only, Stripe for billing). DPA available via Trust Center. | Infisical (one existing project, lacks E2E encryption), Doppler (US-only hosting) | Jun 2026 |
| 31 | **Denormalize `workspace_id` onto runs/jobs (not steps)** | Workspace-scoped queries hit runs/jobs constantly (dashboard, lists) — avoiding deep JOINs matters; steps only load in single-run context so JOIN is fine there | Fully normalized (rejected — JOIN cost on hot paths), denormalize everywhere incl steps (rejected — unnecessary) | Jun 2026 |
| 37 | **Vendor-neutral schema, GitHub-only MVP** | Core tables use neutral names (`integrations`, `pipeline_*`, `external_*`, `integrations.provider`) so additional CI platforms can be added post-MVP without schema migrations. MVP product, onboarding, webhooks, and ingestion remain GitHub Actions only — no provider abstraction layer or multi-provider UI | GitHub-specific schema names (rejected — costly to rename later), full multi-provider architecture pre-launch (rejected — YAGNI before product validation) | Jun 2026 |
| 38 | **Ephemeral containers for integration tests (CI + local)** | Postgres + Redis per run; no Neon in tests; no `DATABASE_URL` in `ci`/Development Phase envs. **CI:** GHA `services:`. **Local:** same images, random host ports. **Cleanup mandatory** on success, failure, and interrupt (`EXIT`/`SIGINT`/`SIGTERM`) — stop containers, remove volumes, prune orphans. Hosted DB (Neon) only for staging/production | Neon CI branches (rejected), shared local `docker compose` for tests (rejected — port conflicts, stale state), skip cleanup on failure (rejected — leaks containers) | Jun 2026 |

---

## 28. Open Questions

| # | Question | Area | Priority | Notes |
|---|---|---|---|---|
| 1 | Domain name | Business | — | `pipewatch.app` — secured ✓ |
| 2 | GitHub App handle | Integration | — | `pipewatch` — available ✓, secure on project creation |
| 3 | Polling interval | Architecture | — | **Resolved:** per-repo, default 60s, min 30s — Decision #8 ✓ |
| 4 | Log storage | Architecture | — | **Resolved:** never store, always link to GitHub — Decision #6 ✓ |
| 5 | Retention config | Product | — | **Resolved:** per-repo in UI, plan as ceiling — Decision #7 ✓ |
| 6 | GitHub App visibility for MVP | Integration | — | **Resolved:** private — Decision #9 ✓ |
| 7 | SSE vs WebSocket | Architecture | — | **Resolved:** SSE — Decision #5 ✓ |
| 8 | Neon project structure | Infrastructure | — | **Resolved:** separate projects per env (staging + prod) — Decision #17 ✓ |
| 9 | Waitlist tool | Marketing | — | **Resolved:** Postmark + own `subscribers` table — Decision #10 ✓ |
| 10 | Insights time range | Product | — | **Resolved:** fixed toggle (7d/30d) for MVP, date picker post-MVP — Decision #19 ✓ |
| 11 | Repo limit enforcement | Product | — | **Resolved:** hard block (403) — Decision #18 ✓ |
| 12 | ReportPortal instance URL | Testing | — | **Resolved:** `REPORTPORTAL_URL` as GHA **secret** in `ci` environment (Phase sync) — workflows use `${{ secrets.REPORTPORTAL_URL }}` ✓ |

---

## 29. Post-MVP Roadmap

| Feature | Description | Target |
|---|---|---|
| Webhook Gateway | Cloud relay so self-hosted instances don't need a public endpoint | v1.1 |
| Alerts & Notifications | Slack/email on workflow failure, configurable rules | v1.1 |
| Longer retention | 90d / 1y for cloud/pro tier | v1.1 |
| Re-run workflows | Trigger re-run directly from PipeWatch UI | v1.2 |
| Issue Tracker Sync | Auto-create/close issues in Jira/GitHub/Linear on pipeline state | v1.2 |
| AI Recommendations | AI-powered pipeline optimization + failed-run resolution suggestions | v1.3 |
| SSO | SAML/OIDC for enterprise self-hosted | v1.3 |
| Advanced analytics | P50/P95 duration, flaky test detection, cost estimation | v1.3 |
| GitHub Enterprise Server | Support for on-prem GitHub | v2.0 |
| Additional CI platforms | GitLab CI and other providers via `integrations.provider` | post-MVP |
| Loops integration | Transactional email for invites, waitlist, notifications | v1.1 |

### 29.1 AI Recommendations (v1.3)

AI-assisted insights layered on top of the run/job/step data PipeWatch already stores. Two distinct capabilities:

**Pipeline optimization recommendations**
- Analyse historical run data per workflow: step durations, caching patterns, parallelization, redundant steps
- Surface concrete suggestions: "Job `test` could run in parallel with `lint` — est. 2m saved per run", "Dependency install isn't cached — adding cache could save ~40s/run", "This step fails intermittently (12% flaky) — consider retry or investigation"
- Ranked by estimated time/cost impact

**Failed-run resolution**
- On a failed run, analyse the failure context (which step, conclusion, available metadata) and surface likely causes + suggested fixes
- Pattern-match against historical failures in the same workspace ("this same step failed the same way 3 times last week")
- Note: no raw log storage in MVP (Decision #6) — AI resolution quality depends on what failure context is available. Evaluate whether opt-in failure-log capture (failed steps only, last N lines) is needed to make this feature genuinely useful. This is a prerequisite design decision for v1.3.

**Open design questions (to resolve before v1.3):**
- LLM provider: BYO API key (self-hosted CE) vs. managed (cloud)? Likely BYO for CE, bundled for cloud paid tiers.
- Does this require the partial failure-log capture deferred in Decision #6?
- Edition gating: cloud-only, or CE with BYO key?
- Cost model: per-recommendation, included in plan, or metered?

### 29.2 Issue Tracker Sync (v1.2)

Bidirectional sync between pipeline state and external issue trackers. Opt-in per workspace, configurable per repo.

**Supported targets (phased):** GitHub Issues (first — same ecosystem, easiest), then Linear, then Jira.

**Behaviour:**
- On pipeline failure → auto-create an issue in the configured tracker, with run context (workflow, branch, commit, failed step, link back to PipeWatch run detail)
- On pipeline recovery (same workflow + branch goes green again) → auto-close the previously created issue, with a comment noting recovery
- De-duplication: one open issue per (repo + workflow + branch) failure signature — don't spam a new issue every failed run; update/comment on the existing one instead
- Configurable triggers: which workflows, which branches (e.g. only `main`), failure threshold (immediate vs. N consecutive failures)

**Data model additions (v1.2):**
- `issue_tracker_integrations` — per-workspace connection (provider, auth token/OAuth, target project/repo, config)
- `synced_issues` — maps (repo + workflow + branch failure signature) → external issue ID + state, for de-dup and auto-close

**Open design questions (to resolve before v1.2):**
- Auth per provider: OAuth app vs. PAT vs. API token — each tracker differs
- How to define a "failure signature" for de-dup (workflow + branch is a starting point; may need more granularity)
- Edition gating: cloud-only, or CE with BYO tracker credentials? (Likely both — CE users configure their own tracker tokens)
- Relationship to Alerts & Notifications (v1.1) — shared config surface or separate?

---

*PipeWatch MVP PRD v0.7 — MDG Labs — June 2026*
