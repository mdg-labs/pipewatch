# PipeWatch — Linear board reference

Orchestrator and **sub-agents** use this when a prompt includes a **LINEAR SYNC** block.

Full migration spec: `docs/internal/Linear_Migration_Assessment.md`.

## Operating mode (post-MVP)

MVP phased roadmap (P0–P21) is **complete**. Normal work: **bugs**, **fixes**, and **iteration tasks** — file via linear-intake/triage, implement via `PW-N`. Epics only when scope genuinely needs parent + children.

## Workspace

| Field | Value |
|---|---|
| MCP server | `plugin-linear-linear` |
| Workspace | `linear.app/mdg-labs` |
| Team | **PipeWatch** (key: `PW`) |
| Team ID | `8efd71ec-7e20-4b5e-a5bf-9ab66fced0e3` |
| Project | **PipeWatch Roadmap** |
| Project ID | `41adac83-1a88-47af-a433-18fcc4e2466e` |
| Issue URL | `https://linear.app/mdg-labs/issue/PW-<N>/<slug>` |
| Task ID format | `PW-<N>` — **only** ID in prompts, plans, Slack |
| Git repo (commits) | `mdg-labs/pipewatch` — `fixes #N` in git; `#N` from Linear sync attachment |

## Two identifiers

| Context | ID | Example |
|---|---|---|
| Operator, orchestrator, intake, triage, status, comments | Linear | `PW-216` |
| Git commit subject & body | GitHub (from sync) | `[#41]`, `fixes #41` |
| Verifier commit audit | GitHub | `git log --grep='fixes #41'` |

Resolve GitHub `#N` from Linear before commit — **never** use `user-github` issue APIs:

```json
{ "server": "plugin-linear-linear", "toolName": "get_issue", "arguments": { "id": "PW-216" } }
```

Parse `attachments[].url` → `…/issues/41` or `attachments[].title` → `#41 …`.

## Tool selection policy

**Linear MCP is the default** for all task tracking. **Forbidden:** `user-github` `issue_read`, `issue_write`, `search_issues`, `add_issue_comment`, GraphQL project Status.

| Operation | Tool |
|---|---|
| Read issue | `get_issue` (`includeRelations: true` for blockers) |
| List / search | `list_issues` (`team`, `parentId`, `query`, `state`, `label`) |
| Create / update | `save_issue` |
| Epic children | `list_issues` with `parentId: "PW-<epic>"` |
| Set status | `save_issue` → `state: "In Progress"` etc. |
| Comments (operational) | `save_comment` in **GitHub-synced thread** (see below) |
| Block dependencies | `save_issue` → `blockedBy: ["PW-238"]` |
| Dependabot alerts | CLI `gh api` (read only) |

Pass markdown to Linear MCP with **literal newlines** — no `\n` escape sequences.

## Issue statuses (PipeWatch team)

```
Backlog → Ready → In Progress → In Review → Done → Closed
                        ↓
                   Canceled / Duplicate
```

| Status | Who sets it | When |
|---|---|---|
| Backlog | Default | Unrefined |
| Ready | intake / triage | Fully specified |
| In Progress | **Execution** | First action (leaf + parent epic) |
| In Review | **Execution** | Last action before verifier |
| Done | **Verifier** + **Orchestrator** confirm | After all layers PASS |
| Ready (again) | **Verifier** | On FAIL |
| Canceled | Orchestrator / user | Declined |

Status names work directly in `save_issue` — no hardcoded UUIDs.

## Required fields — every new issue

| Field | Linear implementation |
|---|---|
| **Type** | Label: `type:task` / `type:bug` / `type:epic` |
| **Domain** | Label: `domain:frontend` \| `domain:backend` \| `domain:infrastructure` \| `domain:operations` |
| **Priority** | `priority: 1–4` (1=Urgent, 2=High, 3=Medium, 4=Low) |
| **Effort** | `effort:XS`–`XL` label + optional `estimate` |
| **Assignee** | `assignee: "me"` |
| **Project** | `project: "PipeWatch Roadmap"` |

### Priority mapping (intake)

| Label / intake | `priority` value |
|---|---|
| Urgent | 1 |
| High | 2 |
| Medium | 3 |
| Low | 4 |

### Domain labels

| Label | Scope |
|---|---|
| `domain:frontend` | `apps/web`, dashboard, onboarding, SSE client |
| `domain:backend` | `apps/api`, `apps/worker`, auth, webhooks, billing |
| `domain:infrastructure` | DB, CE Docker, CI/CD, Fly.io, CF, Redis |
| `domain:operations` | Marketing, docs, launch |
| `regression` | Re-filed bug — with domain label |

## Comment sync (Linear → GitHub mirror)

Operational comments (verifier PASS/FAIL, orchestrator notes) **must** reply in the **GitHub-synced thread** on the Linear issue:

1. `list_comments` on `PW-N`
2. Find root: `author: null`, body mentions *synced to a corresponding GitHub issue*
3. `save_comment` with `parentId` = that root's `id`

**Forbidden:** top-level `save_comment` for agent output; `add_issue_comment`.

Triage **findings** go in issue **description** (`save_issue`), not comments.

## Status sync — sub-agent duties + orchestrator guarantee

### Execution — first action (non-negotiable)

**Before** session memory, **before** `Read`/`Grep`/`Glob`, **before** any implementation:

1. `get_issue` on leaf (+ parent) → resolve **COMMIT LINK** (`githubNumber` from attachments)
2. `save_issue` → `state: "In Progress"` on **leaf + parent epic**
3. Report `BOARD STATUS: In Progress on PW-<N>` in agent output

If step 2 fails → `BOARD_SYNC: FAILED` and **stop**.

### Execution — last actions

1. Session memory: `ended` + `duration`
2. `save_issue` → **In Review** (leaf only)
3. Single implementation commit with `[#N]` / `fixes #N` (GitHub numbers from COMMIT LINK)

### Verifier — after PASS

1. `save_comment` in synced thread (PASS summary)
2. `save_issue` → **Done** (leaf + parent if `CLOSE_PARENTS`)

### Verifier — on FAIL

1. `save_comment` in synced thread (FAIL summary)
2. `save_issue` → **Ready**

### Orchestrator — after every verifier PASS (mandatory)

1. `save_issue` → **Done** on leaf (and parent per `CLOSE_PARENTS`)
2. `get_issue` → confirm `status` is **Done**; retry once if not
3. **Commit-linkage audit:** map `PW-N` → `#N`; `git log staging --grep='fixes #N'`

## Verifier Done comment (mandatory on PASS)

```markdown
**Verified** `abc1234`

Brief summary of what was implemented.

AC met:
- Criterion 1
- Criterion 2

Lint, typecheck, unit tests pass. No deviations.
```

Post via `save_comment` + synced thread `parentId`.

## LINEAR SYNC blocks

### Execution variant

```text
LINEAR SYNC — EXECUTION:
- MCP server: plugin-linear-linear
- team: PipeWatch
- project: PipeWatch Roadmap
- issues: [{ id: PW-<LEAF> }, { id: PW-<PARENT> }]  # omit parent if none
- CLOSE_PARENTS: [PW-<PARENT>] | none
- FIRST ACTION: save_issue state → In Progress (all listed) BEFORE session memory or code
- LAST ACTIONS: session ended → In Review (leaf only) → commit
- COMMIT LINK: leaf PW-<LEAF> → #[<N>]; parent PW-<PARENT> → #[<P>] (from get_issue attachments)
- COMMIT: `[#<N>]` in subject (+ `[#<P>]` when subtask); `fixes #<N>` in body; `refs #<P>` on subtasks; `fixes #<P>` per CLOSE_PARENTS (final child only)
- COMMENTS: synced-thread save_comment only
- FORBIDDEN: state → Done during execution; fixes PW-N; user-github issue tools
- OUTPUT: BOARD STATUS lines (In Progress at start, In Review at handoff)
```

### Verifier variant

```text
LINEAR SYNC — VERIFIER:
- issues: [{ id: PW-<LEAF> }]
- CLOSE_PARENTS: [PW-<PARENT>] | none
- DISPATCH: readonly MUST be false (Linear MCP writes)
- AFTER PASS: synced-thread comment → state → Done → re-query status in output
- AFTER FAIL: synced-thread comment → state → Ready
- COMMIT AUDIT: git log staging --grep='fixes #<N>' (N from COMMIT LINK / map)
- Orchestrator re-syncs Done after PASS regardless
```

## Epic pattern

- Parent: `type:epic` label; children via `parentId`
- Orchestrator cites **`PW-N`** in batch plans only
- Commits use GitHub `#N` resolved from Linear sync
- `list_issues` with `parentId` for epic children
- Default: **Lane S serial** unless parallelism rules allow Lane P

## Blocking dependencies

A task blocked by `PW-N` is **unblocked** when that issue's Linear `status` is **Done** or **Closed** — use `get_issue` or `includeRelations`, not GitHub issue state.

Set via `save_issue` → `blockedBy: ["PW-238"]`.
