# PipeWatch

Open-core GitHub Actions dashboard — aggregates workflow runs across repositories into a single real-time interface.

**PipeWatch CE** (self-hosted, Docker Compose) and **PipeWatch Cloud** (managed) ship from this monorepo.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 LTS (see `.nvmrc`)
- [pnpm](https://pnpm.io/) 9.x (`corepack enable`)
- [Docker](https://www.docker.com/) — required for integration tests (ephemeral Postgres + Redis containers)

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:integration` | Run integration tests (requires Docker) |
| `pnpm test:e2e` | Run Playwright end-to-end tests |

## Integration tests

Integration tests use **ephemeral Postgres 16 and Redis 7 containers** — not Neon, not your running `docker compose` stack, and no `DATABASE_URL` from Phase Development (PRD §11, Decision #38).

`pnpm test:integration` runs `scripts/test-with-deps.sh`, which:

1. Starts labeled `postgres:16-alpine` and `redis:7-alpine` containers with **random host ports** on `127.0.0.1`
2. Exports `DATABASE_URL` and `REDIS_URL` to the Vitest suites
3. Applies Drizzle migrations against the ephemeral database
4. Tears down containers, volumes, and networks on success, failure, or interrupt (`Ctrl+C`)

**Prerequisites:** Docker must be running locally. Node.js 22 and pnpm 9 as above.

Optional ReportPortal reporting: `phase run --env=CI -- pnpm test:integration` (database and Redis still come from ephemeral containers).

Verify cleanup after interrupt:

```bash
bash scripts/test-with-deps.sh --self-test
```

## Layout

```
apps/api          Hono API + webhook receiver
apps/worker       BullMQ worker
apps/web          Next.js dashboard
apps/marketing    Next.js marketing site
packages/db       Drizzle schema and migrations
packages/types    Shared API contracts
packages/config   Shared ESLint and TypeScript configs
packages/utils    Shared utilities
packages/ui       Shared UI components
scripts/          Test orchestration and tooling
```

See `docs/internal/PipeWatch_MVP_PRD.md` for architecture and product specification.

**Customer documentation:** [docs.pipewatch.app](https://docs.pipewatch.app) — source repo [`mdg-labs/pipewatch-docs`](https://github.com/mdg-labs/pipewatch-docs).

## PipeWatch CE — container images (GHCR)

Self-hosted CE images are published to GitHub Container Registry under `ghcr.io/mdg-labs/`:

| Service | Image | Default port |
|---|---|---|
| API | `ghcr.io/mdg-labs/pipewatch-api` | 3000 |
| Worker | `ghcr.io/mdg-labs/pipewatch-worker` | — |
| Web | `ghcr.io/mdg-labs/pipewatch-web` | 3001 |

Common tags: `latest` (stable release), semver release tags, `nightly` (staging builds). The API image runs Drizzle migrations on startup before serving (CE auto-migrate — PRD Decision #36).

Build locally from the repository root:

```bash
docker build -f apps/api/Dockerfile -t pipewatch-api:local .
docker build -f apps/worker/Dockerfile -t pipewatch-worker:local .
docker build -f apps/web/Dockerfile -t pipewatch-web:local .
```

## PipeWatch CE — quickstart (Docker Compose)

Self-hosted CE runs five services: **api**, **worker**, **web**, **postgres**, and **redis**. The API applies Drizzle migrations automatically on startup (Decision #36).

### 1. Create a GitHub App

Follow [PRD §16](docs/internal/PipeWatch_MVP_PRD.md) — set the webhook URL to `https://<your-host>/webhooks/github` (or use `PIPEWATCH_MODE=polling` when you cannot expose a public webhook endpoint).

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with your GitHub App credentials, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` (each at least 32 characters). See [PRD §23](docs/internal/PipeWatch_MVP_PRD.md) for the full variable reference.

| Variable | Required | Notes |
|---|---|---|
| `GITHUB_APP_*`, `GITHUB_CLIENT_*`, `GITHUB_WEBHOOK_SECRET` | Yes | From your GitHub App |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` | Yes | Generate random strings (≥32 chars) |
| `APP_URL`, `MARKETING_URL` | Production | Defaults to `http://localhost:3001` in Compose |
| `NEXT_PUBLIC_API_URL` | Production | Defaults to `http://localhost:3000` in Compose |
| `SMTP_*` | No | Email features degrade gracefully when unset |
| `PIPEWATCH_MODE` | No | `webhook` (default) or `polling` |
| `RETENTION_DAYS` | No | Default `30` |
| `SENTRY_DSN` | No | Optional error monitoring |

### 3. Start the stack

```bash
docker compose up -d
```

| Service | URL / port |
|---|---|
| Dashboard (web) | http://localhost:3001 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

Postgres and Redis data persist in named Docker volumes (`postgres_data`, `redis_data`).

### 4. First-time setup

Open http://localhost:3001 — when no users exist, CE redirects to `/setup` for GitHub OAuth bootstrap (PRD §26).

### Upgrades

Pull the latest images and restart — migrations run automatically when the API container starts:

```bash
docker compose pull
docker compose up -d
```
