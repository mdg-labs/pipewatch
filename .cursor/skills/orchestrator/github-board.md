# PipeWatch — GitHub board reference

Orchestrator and **sub-agents** use this when a prompt includes a **GITHUB SYNC** block.

## Project

| Field | Value |
|---|---|
| Org | `mdg-labs` |
| Repo | `pipewatch` |
| Issue URL | `https://github.com/mdg-labs/pipewatch/issues/N` |
| Project | PipeWatch Roadmap (Projects v2, project number: **5**) |
| MCP server | `user-github` |
| Auto-close | Via `fixes #N` commit convention on merge to `main` |
| Default milestone | **MVP** (#1) |
| Roadmap issue map | `docs/internal/github-roadmap-issue-map.json` (roadmap ID → `#N`, `databaseId`, `node_id`) |

### Roadmap epic numbers (orchestrator quick ref)

| Phase | GitHub `#` | Phase | GitHub `#` |
|---|---|---|---|
| P0 | 4 | P10 | 14 |
| P1 | 5 | P11 | 15 |
| P2 | 6 | P12 | 16 |
| P3 | 7 | P13 | 17 |
| P4 | 8 | P14 | 18 |
| P5 | 9 | P15 | 19 |
| P6 | 10 | P16 | 20 |
| P7 | 11 | P17 | 21 |
| P8 | 12 | P18 | 22 |
| P9 | 13 | P19 | 23 |
| P21 | 24 | | |

Leaf tasks: **#25–#119**. Full per-task map in `github-roadmap-issue-map.json`.

## ID types (do not mix these up)

| Operation | ID kind | GraphQL field | MCP param |
|---|---|---|---|
| `sub_issue_write` | **database ID** (integer) | `databaseId` | `sub_issue_id` |
| `addBlockedBy` / `removeBlockedBy` | **node ID** (`I_kwD…`) | `id` | — (CLI GraphQL only) |
| `updateProjectV2ItemFieldValue` | **project item ID** (`PVTI_lAD…`) | `projectItems.nodes[].id` | — |
| `setIssueFieldValue` (org fields) | issue **node ID** (`I_kwD…`) | `id` | — |

`github-roadmap-issue-map.json` already stores `number`, `id` (databaseId), and `node_id` per task — use it instead of re-querying during orchestration.

## Tool selection policy

**MCP is the default.** Use `user-github` MCP unless the table below requires CLI or GraphQL.

| Operation | Tool |
|---|---|
| Create / update issue | MCP `issue_write` |
| Read issue / comments / sub-issues | MCP `issue_read` |
| List / search issues | MCP `list_issues` / `search_issues` |
| Add comment | MCP `add_issue_comment` |
| Link sub-issue | MCP `sub_issue_write` (requires database IDs) |
| Set project Status | GraphQL `updateProjectV2ItemFieldValue` |
| Get project item ID | GraphQL `repository.issue.projectItems` |
| Dependabot alerts | CLI `gh api` (REST) |
| Issue database IDs | CLI `gh api graphql` |
| Milestones | CLI `gh api /repos/mdg-labs/pipewatch/milestones` |
| Blocked-by dependencies | GraphQL `addBlockedBy` / `removeBlockedBy` |

### Getting database IDs for sub_issue_write

```bash
gh api graphql -f 'query=query { repository(owner:"mdg-labs", name:"pipewatch") {
  issue(number:N) { databaseId number title }
} }'
```

## Projects v2 Status (via GraphQL)

**Hardcoded IDs** (project #5):

| Entity | ID |
|---|---|
| Project node ID | `PVT_kwDODv-LLc4Ba3QP` |
| Status field ID | `PVTSSF_lADODv-LLc4Ba3QPzhVryEg` |
| Backlog | `9485f8e2` |
| Ready | `a0e7153f` |
| In Progress | `47fc9ee4` |
| In Review | `81f76819` |
| Done | `98236657` |
| Closed | `99be8811` |
| Declined | `e36e1062` |

**Read-only project fields** (derived by GitHub — never set via `updateProjectV2ItemFieldValue`):

| Field | ID |
|---|---|
| Parent issue | `PVTF_lADODv-LLc4Ba3QPzhVryE8` |
| Sub-issues progress | `PVTF_lADODv-LLc4Ba3QPzhVryFA` |

Org Priority/Effort appear on issues via `issue_fields`, not the project-level Priority column (`PVTSSF_lADODv-LLc4Ba3QPzhVryH0`, empty options).

**Step 1 — Get project item ID:**

```bash
gh api graphql -f 'query=query {
  repository(owner:"mdg-labs",name:"pipewatch") {
    issue(number:N) {
      projectItems(first:10) {
        nodes { id project { number } }
      }
    }
  }
}'
```

Filter `nodes` where `project.number == 5`, take the `id`.

**Step 2 — Set Status:**

```bash
gh api graphql -f 'query=mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwDODv-LLc4Ba3QP"
    itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lADODv-LLc4Ba3QPzhVryEg"
    value: { singleSelectOptionId: "<OPTION_ID>" }
  }) {
    projectV2Item {
      fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue { name }
      }
    }
  }
}'
```

## Blocked-by dependencies (GraphQL only)

Separate from parent/child sub-issues. Roadmap `Depends on: #N` in issue bodies is **not** wired as native blocked-by yet — optional follow-up.

```bash
# Node IDs (I_kwD…), NOT databaseId
gh api graphql -f 'query=query { repository(owner:"mdg-labs",name:"pipewatch") {
  blocked: issue(number:<BLOCKED>) { id }
  blocking: issue(number:<BLOCKING>) { id }
} }'

gh api graphql -f 'query=mutation {
  addBlockedBy(input: {
    issueId: "<BLOCKED_NODE_ID>"
    blockingIssueId: "<BLOCKING_NODE_ID>"
  }) { issue { number } blockingIssue { number } }
}'
```

`"Target issue has already been taken"` = dependency already exists (no-op).

## Org-level issue types

MCP `issue_write` → `type` uses the **name** string. GraphQL `updateIssue(issueTypeId)` uses the ID.

| Type | GraphQL ID | Use for |
|---|---|---|
| **Task** | `IT_kwDODv-LLc4B0C98` | Concrete implementation work |
| **Bug** | `IT_kwDODv-LLc4B0C99` | Defects, regressions, Dependabot alerts |
| **Feature** | `IT_kwDODv-LLc4B0C9-` | Epics — parent containers for sub-issues |

## Org custom fields — Priority & Effort

**MCP (preferred):** `issue_fields` with `field_name` + `field_option_name` — no IDs needed.

```json
"issue_fields": [
  { "field_name": "Priority", "field_option_name": "Medium" },
  { "field_name": "Effort", "field_option_name": "Low" }
]
```

**GraphQL `setIssueFieldValue`** (fallback / batch scripts) — hardcoded org field IDs:

| Field | Field ID |
|---|---|
| Priority | `IFSS_kgDOAkmjgg` |
| Effort | `IFSS_kgDOAkmjhQ` |

| Priority option | Option ID |
|---|---|
| Urgent | `IFSSO_kgDOBADGPQ` |
| High | `IFSSO_kgDOBADGPg` |
| Medium | `IFSSO_kgDOBADGPw` |
| Low | `IFSSO_kgDOBADGQA` |

| Effort option | Option ID |
|---|---|
| High | `IFSSO_kgDOBADGQQ` |
| Medium | `IFSSO_kgDOBADGQg` |
| Low | `IFSSO_kgDOBADGQw` |

### Effort labels vs org Effort field (both required)

Roadmap issues carry **labels** `effort:XS` … `effort:XL`. The org **Effort** field only accepts `High` / `Medium` / `Low`. Map when setting `issue_fields`:

| Label | Org Effort |
|---|---|
| `effort:XS`, `effort:S` | Low |
| `effort:M` | Medium |
| `effort:L`, `effort:XL` | High |

Do **not** use typo labels `effort:** S` / `effort:** M` (strays from intake — ignore or remove).

## Required fields — every issue must have all six

| Field | How to set |
|---|---|
| **Type** | MCP `issue_write` → `type` |
| **Domain label** | MCP `issue_write` → `labels` (`domain:frontend` \| `domain:backend` \| `domain:infrastructure` \| `domain:operations`) |
| **Priority** | MCP `issue_write` → `issue_fields` |
| **Effort** | MCP `issue_write` → `issue_fields` (see label mapping above) |
| **Assignee** | MCP `issue_write` → `assignees` (use MCP `get_me`) |
| **Milestone** | MCP `issue_write` → `milestone` — default **1** (MVP) for roadmap work |

Valid Priority: `Urgent`, `High`, `Medium`, `Low`. Valid Effort: `High`, `Medium`, `Low`.

### Optional metadata labels (roadmap issues)

| Label | Meaning |
|---|---|
| `type:epic` | Feature parent |
| `type:task` | Leaf task |
| `effort:XS` … `effort:XL` | T-shirt size (paired with org Effort field) |
| `regression` | Reopened bug — always with a `domain:*` label |

## Status workflow

```
Backlog → Ready → In Progress → In Review → Done → Closed
                        ↓
                   Declined
```

| Status | Who sets it | When |
|---|---|---|
| Backlog | Default | Unrefined |
| Ready | intake / triage / orchestrator / user | Fully specified |
| In Progress | **Execution** | First action, before code |
| In Review | **Execution** | Last action before verifier |
| Done | **Verifier** | After all layers PASS |
| Closed | GitHub workflow (auto) | `fixes #N` lands on `main` |
| Declined | Orchestrator / user | Permanently declined |

Verifier FAIL → Status **Ready** + `add_issue_comment`.

### FORBIDDEN — agents must not set GitHub issue state

Never modify issue `open`/`closed`. Use board Status only.

## Domain labels

| Label | Scope |
|---|---|
| `domain:frontend` | `apps/web`, Next.js dashboard, SSE client, onboarding UI |
| `domain:backend` | `apps/api`, `apps/worker`, auth, webhooks, billing, pipelines |
| `domain:infrastructure` | Database, Docker/CE, CI/CD, Fly.io, CF Workers, Redis |
| `domain:operations` | Marketing site, docs, launch, runbooks |
| `regression` | Previously fixed bug reappeared — always with a `domain:*` label |

## Milestones

| # | Title | State |
|---|---|---|
| 1 | MVP | open |

For net-new non-roadmap work, fetch if unsure:

```bash
gh api /repos/mdg-labs/pipewatch/milestones --jq '.[] | {number, title, state, due_on}'
```

## Status sync — sub-agent duties

### Execution — first action

Set Status → **In Progress** on every listed issue (leaf + parent epic).

### Execution — last actions

1. Session memory: `ended` + `duration`
2. Status → **In Review** (leaf only)
3. Single implementation commit

### Verifier — after PASS

1. `add_issue_comment` (mandatory summary)
2. Status → **Done** (leaf + parent if final child)

### Verifier — on FAIL

Status → **Ready** + FAIL comment. Do NOT set Done.

## Verifier Done comment (mandatory on PASS)

```markdown
**Verified** `abc1234`

Brief summary of what was implemented.

AC met:
- Criterion 1
- Criterion 2

Lint, typecheck, unit tests pass. No deviations.
```

## Verifier FAIL comment

```markdown
**Verification failed**

Layer 1 (scope): PASS
Layer 2 (automated): FAIL — typecheck error in `file.ts:42`
Layer 3 (logic): PASS

`file.ts:42` — problem — fix hint per PRD/issue AC.
```

## GITHUB SYNC blocks

### Execution variant

```text
GITHUB SYNC — EXECUTION:
- MCP server: user-github
- owner: mdg-labs
- repo: pipewatch
- project: 5 (PipeWatch Roadmap)
- issues: [{ number: 12 }, { number: 8 }]  # leaf + parent if subtask
- CLOSE_PARENTS: [#8] | none
- FIRST ACTION: Status → In Progress (all listed) BEFORE session memory
- LAST ACTIONS: session ended → Status → In Review (leaf) → commit
- FORBIDDEN: Status → Done; verification comments; committing session memory
- COMMIT: [#<leaf>] in subject; fixes #<leaf> in body; fixes parents per CLOSE_PARENTS
- Reference: .cursor/skills/orchestrator/github-board.md
```

### Verifier variant

```text
GITHUB SYNC — VERIFIER:
- project: 5
- issues: [{ number: 12 }]
- CLOSE_PARENTS: [#8] | none
- AFTER PASS: comment → Status → Done
- AFTER FAIL: FAIL comment → Status → Ready
```

## Epic pattern

Feature parent → sub-issues (Tasks/Bugs). Implement **leaves** only.

- Parent **In Progress** when any child starts.
- Parent **Done** when last in-scope child verifies PASS.
- `fixes #<parent>` in commit body only on final child (orchestrator supplies `CLOSE_PARENTS`).
