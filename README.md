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
