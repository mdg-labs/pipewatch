---
name: linear-intake
description: Draft PipeWatch Linear intake plans for bugs, fixes, and iteration work — write to plans/, wait for user approval, then create Ready issues. Never creates issues or starts implementation without explicit approval. Single task/bug is default; epic + children only when scope needs 2+ tasks.
---

# Linear intake (PipeWatch)

Turn a bug report, fix, or iteration request into **Ready** issues on Linear (**PipeWatch** team, `PW-*`). **Default: one Bug or Task** — epics only when scope genuinely needs 2+ independently implementable tasks.

**Two phases — always.** Phase 1 is read-only planning. Phase 2 runs only after the user explicitly approves the plan file.

Board: [orchestrator/linear-board.md](../orchestrator/linear-board.md). Issue bodies: [templates.md](templates.md). Plan file schema: [plan-template.md](plan-template.md). Summaries: [../linear-triage/summary-patterns.md](../linear-triage/summary-patterns.md).

## When to use

| User intent | Action |
|---|---|
| **Bug report / regression** | Plan **one Bug** (`type:bug`) — default path |
| Small fix or improvement | Plan **one Task** (`type:task`) |
| Feature needing **2+ tasks** | Plan **Epic** (`type:epic`) + child tasks |
| User provides `PW-N` draft | **Enrich mode** — plan description/title/label updates |
| User says **"approve"** / **"create the issues"** | **Phase 2** — execute the latest draft plan |
| "Don't create issues" | Phase 1 only — plan file, no Phase 2 |

**Ask in the plan** (or before writing) if priority, domain, or product rules are unclear — do not guess.

## Board constants

```text
MCP server: plugin-linear-linear
Team: PipeWatch (key: PW)
Project: PipeWatch Roadmap
Plans directory: .cursor/skills/linear-intake/plans/  (gitignored, local)
```

## Issue summaries

Follow [summary-patterns.md](../linear-triage/summary-patterns.md).

## Dual mode

### Mode A — Create net-new

Plan new issues; create via `save_issue` only in **Phase 2**.

### Mode B — Enrich existing

Plan updates to `PW-N`; apply via `save_issue` (update) only in **Phase 2**. Do not wipe user prose under `## Report`.

---

## Phase 1 — Plan (read-only)

**Never call `save_issue` to create or update issues in Phase 1.**

### 1. Understand

1. Read relevant PRD `§` sections ([doc-index.md](../orchestrator/doc-index.md)).
2. Search codebase for patterns / paths (read-only).
3. Duplicate search: `list_issues` + `query`.
4. Split into **leaf issues** — independently implementable.

### 2. Write plan file

1. Copy structure from [plan-template.md](plan-template.md).
2. Save to `plans/YYYY-MM-DD-<short-slug>.md` (kebab-case slug).
3. Fill **every** planned issue: title, all labels, priority, effort, assignee, project, parent plan-key, blocked-by, full description (from [templates.md](templates.md)), PRD refs, acceptance criteria, expected files.
4. Set plan **Status:** `draft`.
5. If updating an existing issue, use enrich fields in the template (`Target: PW-N`).

### 3. Stop — chat handoff

Reply briefly:

- Path to the plan file (e.g. `plans/2026-06-29-webhook-hmac.md`)
- One-line scope (e.g. "1 bug" or "1 epic + 2 tasks")
- Ask the user to review the plan and reply **approve** (or request edits)

**Do not** paste the full plan into chat. **Do not** create Linear issues. **Do not** start implementation, orchestration, or code changes.

### Edits before approval

If the user requests changes, update the same plan file (or write a new dated slug if scope diverged heavily). Keep **Status:** `draft` until approval.

---

## Phase 2 — Create (after explicit approval)

Run **only** when the user clearly approves (e.g. "approve", "create the issues", "LGTM on the plan").

**Still forbidden:** implementation, orchestration, setting In Progress, or any code changes in this skill.

### 1. Confirm plan

- Open the approved plan file; set **Status:** `approved`.
- If multiple draft plans exist, use the one the user named or the most recently approved.

### 2. Create issues in plan order

Epic first, then children. For each planned issue, `save_issue` with all fields from the plan:

```json
{
  "title": "…",
  "team": "PipeWatch",
  "project": "PipeWatch Roadmap",
  "labels": ["type:task", "domain:backend", "effort:M"],
  "priority": 3,
  "assignee": "me",
  "description": "…",
  "parentId": "PW-215"
}
```

- Replace plan-keys with created `PW-N` for `parentId` and `blockedBy`.
- Enrich mode: `save_issue` with `id: "PW-N"` and planned field updates only.

### 3. Wire dependencies

`save_issue` with `blockedBy: ["PW-238"]` using real keys from step 2.

### 4. Finalize epic description

Update epic via `save_issue`: sub-issues table with real `PW-*` keys, implementation order, PRD `§` refs.

### 5. Verify GitHub sync + set Ready

For each **new** issue:

1. `get_issue` — confirm `attachments` includes GitHub issue URL.
2. `save_issue` → `state: "Ready"`.

If sync is missing, wait/retry before marking Ready.

### 6. Update plan file

- **Status:** `created`
- Fill **Created as:** `PW-___` on each issue block
- Check off post-create checklist

### 7. Chat handoff (create only — no work)

Report:

- Created `PW-N` keys and suggested order
- Plan file path (updated)
- **Stop.** Suggest next step for the operator: `implement PW-N` or `orchestrate PW-<epic>` — do **not** run those yourself.

Intake ends at **Ready** on Linear. Implementation is a separate session.

---

## Domain labels

| Label | Scope |
|---|---|
| `domain:frontend` | `apps/web`, dashboard, onboarding, SSE client |
| `domain:backend` | `apps/api`, `apps/worker`, auth, webhooks, billing |
| `domain:infrastructure` | DB, CE Docker, CI/CD, Fly.io, CF, Redis |
| `domain:operations` | Marketing, docs, launch |

## Forbidden

- Creating or updating Linear issues in **Phase 1**
- Creating issues without **explicit user approval** of the plan file
- Pasting the full intake plan into chat (point to `plans/` file instead)
- Starting implementation, orchestration, or code changes during or immediately after intake
- Setting **In Progress**, **In Review**, or **Done** during intake
- `user-github` issue tools
- Inventing behaviour not in PRD — ask first
- Secrets in issue descriptions or plan files
- Multi-task feature without epic parent in the plan
- Omitting required fields in the plan or on create
- `organization` / `workflow_run` in schema names — use canonical vocabulary (`04-naming.mdc`)

## Required fields (plan + create)

Every planned issue must specify: type label, domain label, priority, effort label, assignee (`me`), project, title, description, parent/blocked-by (or `none`). See [orchestrator/linear-board.md](../orchestrator/linear-board.md) § Required fields.
