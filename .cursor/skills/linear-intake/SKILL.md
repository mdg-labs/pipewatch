---
name: linear-intake
description: Create or enrich PipeWatch Linear issues for bugs, fixes, and iteration work. Single task/bug is the default; epic + children only when scope needs 2+ tasks. Stops at Ready. Use when the user reports a bug, describes a small change, or asks to ticket work before implementation.
---

# Linear intake (PipeWatch)

Turn a bug report, fix, or iteration request into **Ready** issues on Linear (**PipeWatch** team, `PW-*`). **Default: one Bug or Task** — epics only when the operator confirms multi-task scope.

Board: [orchestrator/linear-board.md](../orchestrator/linear-board.md). Templates: [templates.md](templates.md). Summaries: [../linear-triage/summary-patterns.md](../linear-triage/summary-patterns.md).

## When to use

| User intent | Action |
|---|---|
| **Bug report / regression** | **One Bug** (`type:bug`) — default path |
| Small fix or improvement | **One Task** (`type:task`) |
| Feature needing **2+ tasks** (confirmed) | **Epic** (`type:epic`) + child tasks |
| User provides `PW-N` draft | **Enrich mode** — add AC, PRD refs, files |
| "Don't create issues" | Skip MCP; draft markdown plan only |

**Ask before creating** if priority, domain, or product rules are unclear.

## Board constants

```text
MCP server: plugin-linear-linear
Team: PipeWatch (key: PW)
Project: PipeWatch Roadmap
```

## Issue summaries

Follow [summary-patterns.md](../linear-triage/summary-patterns.md).

## Dual mode

### Mode A — Create net-new

Create via `save_issue` with `team: "PipeWatch"`, `project: "PipeWatch Roadmap"`.

### Mode B — Enrich existing

Fetch `PW-N` via `get_issue`, merge structured sections via `save_issue` (update). Do not wipe user prose.

## Domain labels

| Label | Scope |
|---|---|
| `domain:frontend` | `apps/web`, dashboard, onboarding, SSE client |
| `domain:backend` | `apps/api`, `apps/worker`, auth, webhooks, billing |
| `domain:infrastructure` | DB, CE Docker, CI/CD, Fly.io, CF, Redis |
| `domain:operations` | Marketing, docs, launch |

## Workflow

### 1. Understand

1. Read relevant PRD `§` sections ([doc-index.md](../orchestrator/doc-index.md)).
2. Search codebase for patterns / paths.
3. Duplicate search: `list_issues` + `query`.
4. Split into **leaf issues** — independently implementable.

### 2. Draft plan — STOP. Propose structure first.

Present proposed epic/children table with domains, dependencies (`PW-*`), PRD refs. **Wait for user approval** unless they said "create the issues now".

### 3–4. Create epic + children via `save_issue`

All required on create: type label, domain label, priority, effort label, assignee (`"me"`), project.

```json
{
  "title": "…",
  "team": "PipeWatch",
  "project": "PipeWatch Roadmap",
  "labels": ["type:task", "domain:backend", "effort:M"],
  "priority": 3,
  "assignee": "me",
  "parentId": "PW-215"
}
```

### 5. Dependencies

`save_issue` with `blockedBy: ["PW-238"]` (append-only on create/update).

### 6. Finalize epic description

Sub-issues table (`PW-*` keys) + suggested implementation order + PRD `§` refs.

### 7. Verify GitHub sync + set Ready

1. `get_issue` — confirm `attachments` includes GitHub issue URL (bidirectional sync).
2. `save_issue` → `state: "Ready"`.

If no GitHub attachment yet, wait/retry sync before marking Ready for orchestration.

Intake stops at **Ready**.

## Forbidden

- `user-github` issue tools
- Setting In Progress or Done during intake
- Inventing behaviour not in PRD — ask first
- Secrets in issue descriptions
- Multi-task feature without epic parent
- Omitting required fields
- Creating issues without user approval (unless explicitly asked)
- `organization`/`workflow_run` in schema names — use canonical vocabulary (`04-naming.mdc`)

## After creation

Report **`PW-N`** keys, suggested order, and handoff: `"implement PW-N"` or `"orchestrate PW-<epic>"`.
