---
name: github-intake
description: Create or enrich PipeWatch GitHub Issues from a feature description, PRD section, codebase change, or user-drafted issue. Single Task/Bug for small work; Feature (epic) + children for multi-task features. Stops at Ready on project board #5. Use when the user describes a new feature, asks to plan or ticket work, flesh out a draft issue, or break a change into board tasks before implementation.
---

# GitHub intake (PipeWatch)

Turn a feature request, PRD section, or rough draft into **Ready** issues on the PipeWatch GitHub project (**#5**). Canonical spec: `docs/internal/PipeWatch_MVP_PRD.md`.

Board sync: [orchestrator/github-board.md](../orchestrator/github-board.md). Templates: [templates.md](templates.md). Summaries: [../github-triage/summary-patterns.md](../github-triage/summary-patterns.md).

## When to use

| User intent | Action |
|---|---|
| Feature needing **2+ tasks** | **Feature (epic)** + child Tasks/Bugs |
| Single task sufficient | **One** Task or Bug |
| Bug fix | Bug in affected domain |
| User provides `#N` draft | **Enrich mode** — add AC, PRD refs, files, children |
| "Don't create issues" | Skip MCP; draft markdown plan only |

**Ask before creating** if priority, domain, or product rules are unclear.

## Board constants

```text
MCP server: user-github
Owner: mdg-labs
Repo: pipewatch
Project number: 5 (PipeWatch Roadmap)
```

## Issue summaries

Follow [summary-patterns.md](../github-triage/summary-patterns.md).

## Dual mode

### Mode A — Create net-new

Fetch milestones before creating:

```bash
gh api /repos/mdg-labs/pipewatch/milestones --jq '.[] | {number, title, state, due_on}'
```

### Mode B — Enrich existing

Fetch `#N` via MCP `issue_read`, merge structured sections via `issue_write` (update). Do not wipe user prose.

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
3. Duplicate search: MCP `search_issues`.
4. Split into **leaf issues** — independently implementable.

### 2. Draft plan — STOP. Propose structure first.

Present proposed epic/children table with domains, dependencies, PRD refs. **Wait for user approval** unless they said "create the issues now".

### 3–4. Create Feature + children via MCP `issue_write`

All six required on create: type, domain label, Priority, Effort, assignee (`get_me`), milestone.

### 5. Sub-issue relationships

```bash
gh api graphql -f 'query=query { repository(owner:"mdg-labs", name:"pipewatch") {
  issue(number:8) { databaseId } issue(number:9) { databaseId } } }'
```

MCP `sub_issue_write` (method: add).

### 5a. Dependencies (blocked-by)

GraphQL `addBlockedBy` with Node IDs (`I_...`) — see slugbase pattern in templates.

### 6. Finalize Feature description

Sub-issues table + suggested implementation order + PRD `§` refs.

### 7. Set Status → Ready

```bash
ITEM_ID=$(gh api graphql -f 'query=query { repository(owner:"mdg-labs",name:"pipewatch") { issue(number:N) { projectItems(first:10) { nodes { id project { number } } } } } }' --jq '.data.repository.issue.projectItems.nodes[] | select(.project.number == 5) | .id')

gh api graphql -f 'query=mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwDODv-LLc4Ba3QP"
    itemId: "'"$ITEM_ID"'"
    fieldId: "PVTSSF_lADODv-LLc4Ba3QPzhVryEg"
    value: { singleSelectOptionId: "a0e7153f" }
  }) { projectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } }
}'
```

Intake stops at **Ready**.

## Forbidden

- `gh issue create` — use MCP `issue_write`
- Setting In Progress or Done during intake
- Inventing behaviour not in PRD — ask first
- Secrets in issue descriptions
- Multi-task feature without Feature parent
- Omitting any of the six required fields
- Creating issues without user approval (unless explicitly asked)
- `organization`/`workflow_run` in schema names — use canonical vocabulary (`04-naming.mdc`)

## After creation

Report issue numbers, suggested order, and handoff: `"implement #N"` or `"orchestrate #epic"`.
