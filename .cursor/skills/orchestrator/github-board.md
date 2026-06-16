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

## Org-level issue types

Discover via `list_issue_types` (owner: `mdg-labs`).

| Type | Use for |
|---|---|
| **Task** | Concrete implementation work |
| **Bug** | Defects, regressions, Dependabot alerts |
| **Feature** | Epics — parent containers for sub-issues |

## Required fields — every issue must have all six

| Field | How to set |
|---|---|
| **Type** | MCP `issue_write` → `type` |
| **Domain label** | MCP `issue_write` → `labels` |
| **Priority** | MCP `issue_write` → `issue_fields` |
| **Effort** | MCP `issue_write` → `issue_fields` |
| **Assignee** | MCP `issue_write` → `assignees` (use MCP `get_me`) |
| **Milestone** | MCP `issue_write` → `milestone` |

Valid Priority: `Urgent`, `High`, `Medium`, `Low`. Valid Effort: `High`, `Medium`, `Low`.

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

```bash
gh api /repos/mdg-labs/pipewatch/milestones --jq '.[] | {number, title, state, due_on}'
```

Pick earliest open milestone by `due_on` unless user specifies otherwise.

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
