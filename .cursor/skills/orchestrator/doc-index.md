# PipeWatch — Spec doc index

Quick reference for orchestrator traceability and sub-agent **DOC REFERENCE** blocks.
Sub-agents read these files themselves — never paste content into prompts.

## Precedence (when docs conflict)

1. `docs/internal/PipeWatch_MVP_PRD.md` — **product source of truth**
2. `docs/internal/PipeWatch_Page_Inventory.md` — **UI/page source of truth** (PRD wins on product conflict)

## Doc shorthand

| Shorthand | File | Covers |
|---|---|---|
| `prd` | `docs/internal/PipeWatch_MVP_PRD.md` | Full product & architecture spec |
| `pages` | `docs/internal/PipeWatch_Page_Inventory.md` | Marketing + app page inventory |

Reference sections as `§N` or heading, e.g. `prd §7.1`, `prd §17`, `pages B3`.

### Key PRD sections for sub-agents

| Section | Topic |
|---|---|
| `prd §2` | Goals & non-goals |
| `prd §4` | Architecture, infra, GitHub integration, tech stack |
| `prd §5` | Workspaces & roles |
| `prd §6` | Data model |
| `prd §7` | API design & auth |
| `prd §10` | Phase secrets |
| `prd §11` | Testing strategy |
| `prd §12` | MVP feature scope |
| `prd §13` | Onboarding wizard |
| `prd §14` | Marketing site |
| `prd §15` | NFRs |
| `prd §16` | CE setup UX |
| `prd §17` | Monorepo structure |
| `prd §18` | BullMQ jobs |
| `prd §19` | SSE real-time |
| `prd §20` | Auth flow detail |
| `prd §22` | CI/CD pipeline |
| `prd §23` | Environment variables |
| `prd §24` | Stripe |
| `prd §25` | Docker Compose CE |
| `prd §26` | Edition system (`PIPEWATCH_EDITION`) |
| `prd §27` | Decision log |

## GitHub issue tracking

Issues on `mdg-labs/pipewatch`. Project board: **PipeWatch Roadmap (#5)**.

| Field | Purpose |
|---|---|
| Issue number | Commit suffix `[#12]`, session memory |
| Labels | Domain routing (`domain:frontend`, etc.) |
| Board Status | Execution/verification lifecycle |

## Default verification commands

Run from repo root (Turborepo). Mark `n/a` only when legitimately undefined.

| Check | Command |
|---|---|
| lint | `pnpm lint` |
| typecheck | `pnpm typecheck` |
| unit | `pnpm test:unit` |
| integration | `pnpm test:integration` |
| build | `pnpm build` |
| security audit | `pnpm audit --audit-level=high` |
| e2e (CI only) | `pnpm test:e2e` — not per-task verification |

Local env via Phase CLI (`phase run --env=Development -- …`) when secrets required. Integration tests use ephemeral containers only — never Neon.
