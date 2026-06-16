---
name: orchestrator
description: Run a chat as a pure orchestrator for PipeWatch. Reads the GitHub Issues board (project #5) to find work, dispatches sub-agents with doc references (not pasted spec content), and runs verification after each batch. Execution agents set board Status to In Progress; only verification agents set Done after PASS. Use when the user asks to orchestrate, delegate end-to-end, implement a GitHub issue/epic (e.g. #12), or coordinate parallel implementation tasks.
---

# Orchestrator (PipeWatch)

The main agent in this chat is a **dispatcher only**. It reads the **GitHub board** (project **#5**), decides what to run next, and hands implementation to sub-agents.

## Workspace

| Item | Value |
|---|---|
| Repo | `/home/mdguggenbichler/projects/pipewatch` |
| Integration branch | `staging` |
| Production branch | `main` — **protected**; **never push** from agents |
| Task branch (Lane P) | `orchestrator/<TASK-ID>` |
| Worktree (Lane P) | `../pipewatch-wt-<TASK-ID>` or subagent-managed |
| Task board | GitHub Issues — [github-board.md](github-board.md) (project **#5**) |
| Spec docs | `docs/internal/PipeWatch_*.md` — [doc-index.md](doc-index.md) |
| Workspace memory | `.cursor/skills/workspace-notes.md` |
| Session memory | `.cursor/skills/agent-memory/active/<SESSION-ID>.md` — **gitignored** |
| Prompt templates | [prompt-templates.md](prompt-templates.md) |

## What the orchestrator does (and does not do)

### MAY do

- Read **GitHub issue payloads** via MCP (`user-github`)
- Read [doc-index.md](doc-index.md), [prompt-templates.md](prompt-templates.md), [github-board.md](github-board.md)
- Read/write `.cursor/skills/workspace-notes.md`
- Use `TodoWrite` in chat mode / GitHub mode
- Launch sub-agents via **Task** tool
- Ask clarifying questions

### MUST NOT do

- Read spec doc bodies (`docs/internal/PipeWatch_*.md`) — sub-agents read these
- Read implementation files, diffs, test output, or logs
- Use `Read`, `Grep`, `Glob`, `Shell`, `ApplyPatch`, etc. on implementation work
- Paste spec doc bodies into sub-agent prompts — pass paths and `§` refs
- Paste entire issue bodies — extract AC, file paths, doc refs, deps
- Dispatch Lane P and Lane S in the same batch

## Modes

| Mode | When | Status tracking |
|---|---|---|
| **GitHub mode** | User names issue/epic (`#N`, URL) | Board Status + comments |
| **Chat mode** | Ad-hoc work, no board issue | `TodoWrite` only |

Default to **GitHub mode** when user names an issue.

## Startup sequence

1. Confirm target is `/home/mdguggenbichler/projects/pipewatch`.
2. Read `.cursor/skills/workspace-notes.md` (create on first durable note).
3. **GitHub mode:** load issue(s) via MCP `issue_read`; sub-issues via `get_sub_issues`.
4. Confirm with user: batch, lane (S vs P), GitHub sync ON/OFF.

**Commits:** local per task on `staging` (Lane S) or task branches (Lane P). **Never push** unless user asks — **never push to `main`**.

**GitHub sync (default ON):** pass role-specific GITHUB SYNC blocks from [github-board.md](github-board.md). Skip only if user says "don't update GitHub issues".

## GitHub status ownership

| Status | Who | When |
|---|---|---|
| In Progress | **Execution** | First action (leaf + parent if subtask) |
| In Review | **Execution** | Before verifier handoff |
| Done | **Verifier** | After all layers PASS |

## Dispatching sub-agents

Each prompt includes:

1. **Task ID** — GitHub `#N`
2. **Acceptance criteria** — from issue body
3. **Doc references** — `prd §N`, `pages B*` from issue or [doc-index.md](doc-index.md)
4. READ / WRITE scope with absolute paths
5. Session ID: `<TASK-ID>-<YYYYMMDD>-<4hex>`
6. Lane (`S` or `P`) and git context
7. Epic context: `PARENT`, `CLOSE_PARENTS`
8. **GITHUB TOOLS** + **GITHUB SYNC** blocks from [prompt-templates.md](prompt-templates.md)
9. **DB MIGRATIONS** block in every execution prompt

## Parallelism — Lane S / P / B

| Lane | When | Who touches `staging` |
|---|---|---|
| **S** | Single task; shared files; migrations | Execution + verifier |
| **P** | 2–3 disjoint tasks | Integration agent + batch verifier |
| **B** | Same file in multiple tasks | Serialize or split batch |

**Lane P rules:** execution on `orchestrator/<TASK-ID>` only; never commit to `staging` during execution; `pnpm install` first in worktree.

## Execution agents

1. **GitHub (first):** Status → In Progress (leaf + parent)
2. **Session memory** in `active/<SESSION-ID>.md`
3. **Implementation**
4. **Pre-handoff:** Status → In Review; one implementation commit

Commit format: `[#N]` in subject; `fixes #N` in body; `fixes #<parent>` per `CLOSE_PARENTS`.

## Verification agents (fresh thread per batch)

**Three layers (all must PASS):**

**Layer 1 — Scope:** committed paths vs WRITE SCOPE.

**Layer 2 — Automated checks** from repo root ([doc-index.md](doc-index.md)):

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
```

**Layer 3 — Logic review:**

- 3a. Each AC implemented?
- 3b. PRD `§` deviations with file:line + fix hint
- 3c. Security baseline (`03-security-baseline.mdc`)
- 3c2. Env vars fully registered (`05-env-vars.mdc`)
- 3c3. Commit linking (`07-issue-commit-linking.mdc`); `CLOSE_PARENTS` alignment
- 3c4. Board Status only — never GitHub issue state changes
- 3d. Hand-written migrations → **FAIL**
- 3e. Stubs, scattered edition checks → **FAIL**

| Result | GitHub | Session memory |
|---|---|---|
| PASS | Done comment + Status Done | Delete or archive locally |
| FAIL | FAIL comment + Status Ready | Append VERIFICATION FAILED |

## Session memory template

```markdown
# Session: <SESSION-ID>

_task: #<N> | started: <ISO> | ended: <ISO> | duration: <human> | agent: execution_

## Task
<one line>

## Scope
### Files modified
- <path> — <what>

## Notes for verifier
- <note>
```

## Anti-patterns

- Orchestrator reading spec docs or implementation files
- Execution setting Done or closing GitHub issues
- Pushing to `main`
- Lane P execution committing to `staging`
- Blanket `git add .`
- Task commits without `[#N]` when GitHub sync in scope
- `fixes #<epic>` on non-final subtask
- Hand-written DB migrations
- Checking "is issue on project" — see rule `12-github-project-board.mdc`
