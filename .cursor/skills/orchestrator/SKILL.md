---
name: orchestrator
description: Run a chat as a pure orchestrator for PipeWatch. Reads the GitHub Issues board (project #5), presents a Lane S/P batch plan, then dispatches sub-agents immediately (unless user says wait). Verifies each task and syncs board Status to Done after every PASS. Epic or single issue — start without asking. Use when the user asks to orchestrate, delegate end-to-end, or implement a GitHub issue/epic.
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
- **Board status sync** after verifier PASS — GraphQL `updateProjectV2ItemFieldValue` via Shell/`gh` (see [Board sync](#board-sync-mandatory-orchestrator-owned))
- **Board status audit** — re-query project Status after each task; fix stuck **In Review**
- Ask clarifying questions **only** when target is ambiguous, all children are blocked, or user explicitly paused sync

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

## Default: start immediately (plan first, then dispatch)

Whatever the user throws at `/orchestrator` — **single leaf**, **epic parent**, issue URL, or phase label — **start work immediately**. The user will say explicitly when **not** to start (e.g. `plan only`, `wait`, `hold`, `don't start`).

**Before the first sub-agent dispatch**, the orchestrator **must present a batch plan** to the user:

1. Load target issue(s) + board Status + dependencies.
2. Apply [parallelism rules](#parallelism--orchestrator-decides-serial-vs-parallel) to split work into **batches**.
3. **Output the plan** (see [Batch plan format](#batch-plan-format)) — mandatory user-visible message **before** any `Task` tool call.
4. **Then dispatch** the first batch in the **same turn** (unless user paused).

Do **not** ask “go?” or wait for confirmation. The plan **is** the heads-up; execution follows unless the user already said not to start.

### Batch plan format

```markdown
## Orchestrator plan — <target>

**Lane default:** S on `staging` · **GitHub sync:** ON

| Batch | Lane | Issues | Notes |
|---|---|---|---|
| 1 | S | #31 | tokens — unblocks #32 |
| 2 | S | #32 | core components |
| 3 | P | #33, #35 | disjoint scopes (if Lane P applies) |
| … | | | |

**Skipped (Done):** #25  
**Blocked:** —  
**CLOSE_PARENTS:** `fixes #5` on final child #36 only

→ Starting batch 1…
```

For a **single leaf**, the plan is one row (Batch 1 · Lane S · `#N`).

### Epic (parent issue)

When target is a **Feature/epic**:

1. Load parent via `issue_read` + `get_sub_issues`.
2. Queue all leaves **not Done** on the board; respect `Depends on: #N`.
3. Split queue into batches per parallelism rules (often all Lane S for one epic).
4. Present full multi-batch plan → start batch 1.

Parent **In Progress** when first child starts; parent **Done** only after final child verifies PASS + orchestrator board sync.

User modifiers: `serial` · `parallel` · `from #N` · `plan only` (no dispatch).

### Single leaf

When target is one **Task** (no sub-issues): present one-batch plan → dispatch immediately.

**Commits:** local per task on `staging` (Lane S) or task branches (Lane P). **Never push** unless user asks — **never push to `main`**.

**GitHub sync (default ON):** pass role-specific GITHUB SYNC blocks from [github-board.md](github-board.md). Skip only if user says "don't update GitHub issues".

## Startup sequence

1. Confirm target is `/home/mdguggenbichler/projects/pipewatch`.
2. Read `.cursor/skills/workspace-notes.md`.
3. **GitHub mode:** load issue(s); epics → `get_sub_issues`; query board Status for deps.
4. **Build + present batch plan** (mandatory before first `Task`).
5. **Dispatch batch 1** immediately unless user said not to start.
6. **Ambiguous target only** (no issue number, multiple unrelated epics) → ask once which epic/issue, then plan + start.

## GitHub status ownership

| Status | Who | When |
|---|---|---|
| In Progress | **Execution** | First action (leaf + parent if subtask) |
| In Review | **Execution** | Before verifier handoff |
| Done | **Verifier** (best effort) + **Orchestrator** (mandatory confirm) | After all layers PASS |

### Board sync (mandatory, orchestrator-owned)

**Root cause (P1 #5 run):** Verifiers were launched `readonly: true`, so they could not run GraphQL mutations. They reported PASS while board Status stayed **In Review**. Only some issues were fixed manually afterward.

**Rule:** The orchestrator **always** owns final board correctness. After **every** verifier PASS:

1. **Set Done** via GraphQL on the leaf issue (`Done=98236657`). If `CLOSE_PARENTS` includes the epic, set parent **Done** too.
2. **Re-query** board Status for every issue touched in that task.
3. If Status is still **In Review** (or not **Done**) → **retry** the mutation once; then report failure to user.
4. If verifier did not post a PASS comment → orchestrator posts via MCP `add_issue_comment`.

**Verifier dispatch:** Never set `readonly: true` on verifier sub-agents (they need `gh api graphql` for Status). Even when verifiers run writable, the orchestrator still performs step 1–3 — verifiers are best-effort, orchestrator is source of truth.

**Orchestrator Shell use** is allowed **only** for: board Status read/write, `workspace-notes.md`, epic progress audits, and **commit-linkage audits** (`git log --grep`) — not for reading implementation code or running the CI gate.

### Commit linkage audit (mandatory, orchestrator-owned)

**Root cause (P3/P4 run):** #41 was board **Done** but `6080f19` never landed on `staging`; P2-05 schema arrived later via #47's fix commit with only `fixes #47` — no `fixes #41` anywhere in `staging` history.

**Rule:** Board **Done** is insufficient. Every issue marked **Done** in a run must have `fixes #N` (or `fixes #<parent>` when appropriate) in **at least one commit on `staging`** that is part of the run's commit range (the task commit, a combined commit, or an explicit linkage commit).

**After every verifier PASS** and **before epic close**, the orchestrator **must** audit linkage:

```bash
# For each issue N marked Done in this run (leaves + parents per CLOSE_PARENTS):
git log <base>..staging --grep='fixes #N'
# base = commit before the orchestrator run started, or merge-base with origin/staging
```

| Result | Action |
|---|---|
| `fixes #N` found in run commits | OK |
| Work landed in another issue's commit | That commit body **must** also include `fixes #N` — or cherry-pick `--empty=keep` the original task commit |
| No `fixes #N` anywhere | **FAIL** — do not leave Done; dispatch fix agent or `chore(repo)[#N]: record issue linkage` with `fixes #N` |
| Board Done but commit only on orphan branch | **FAIL** — cherry-pick or re-dispatch; never advance queue |

**Verifier Layer 3c3 (mandatory):** For task `#N`, confirm `git log` on `staging` contains `fixes #N` in the task commit SHA **or** a documented combined/linkage commit. Missing → **FAIL** even if AC and CI pass.

**Combined commits:** When one commit implements multiple issues (e.g. migration fix covers #41 + #47), the commit body lists **every** issue: `fixes #47` and `fixes #41` on separate lines.

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

## Parallelism — orchestrator decides serial vs parallel

The orchestrator **must decide** Lane S, P, or B for each batch — present the decision in the [batch plan](#batch-plan-format); do not ask the user to choose unless genuinely ambiguous.

| Lane | When | Who touches `staging` |
|---|---|---|
| **S** (serial) | Default for epics; shared hot files; DB migrations; single task | Execution + verifier on `staging` |
| **P** (parallel) | 2–3 leaves, **disjoint WRITE scopes**, deps satisfied, no migration conflict | Isolated branches → integration merge |
| **B** (blocked parallel) | Same file/dir in multiple pending leaves | **Serialize** (Lane S) or split scope in issue intake |

### Decision procedure (apply in order)

1. **Dependencies** — only schedule leaves whose `Depends on` issues are **Done** on the board (not GitHub `closed` state).
2. **Epic suggested order** — if parent lists implementation order, follow it unless Lane P is safe for that tier.
3. **Hot-file check** — if two+ ready leaves touch the same path (e.g. `packages/ui/src/index.ts`, `pnpm-lock.yaml`, `packages/db/schema/`, root `package.json`) → **Lane S** or **Lane B** (serialize).
4. **Migrations** — at most one migration-generating task per batch → **Lane S**.
5. **Lane P** — only when 2–3 leaves have **disjoint** write scopes **and** no shared hot files; dispatch together; integration agent merges to `staging`; batch verifier.
6. **Never** mix Lane P and Lane S in the same dispatch wave.

**Epic default:** Lane **S** serial (one leaf → verify → board sync → next leaf) unless step 5 clearly applies.

**Lane P rules:** execution on `orchestrator/<TASK-ID>` only; never commit to `staging` during execution; `pnpm install` first in worktree.

### Epic loop (orchestrator chat)

For each leaf in queue (until all Done or blocked):

```
dispatch execution → dispatch verifier (readonly: false)
→ on PASS: commit-linkage audit (fixes #N on staging) → board sync (Done + re-query)
→ on FAIL: stop or re-dispatch fix per user policy; do not advance queue
→ update workspace-notes.md
```

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
- 3c3. Commit linking (`07-issue-commit-linking.mdc`); `CLOSE_PARENTS` alignment; **`git log staging --grep='fixes #N'` must hit** for the task issue (and combined commits must list every covered `#N`)
- 3c4. Board Status only — never GitHub issue state changes
- 3d. Migration policy violations (`15-db-migrations-schema.mdc`) — hand-written, edited, or deleted committed migrations; schema change without generated migration → **FAIL**
- 3e. Stubs, scattered edition checks → **FAIL**

| Result | Verifier (best effort) | Orchestrator (mandatory) | Session memory |
|---|---|---|---|
| PASS | PASS comment + Status Done | Commit-linkage audit + re-query Status; fix if not Done; parent Done per CLOSE_PARENTS | Delete or archive locally |
| FAIL | FAIL comment + Status Ready | Confirm Ready on board | Append VERIFICATION FAILED |

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
- **Dispatching sub-agents before presenting the batch plan**
- **Asking “go?” or waiting for confirmation** — present plan, then start (unless user said `plan only` / `wait`)
- **Trusting verifier PASS text** without orchestrator board re-query (leaves stuck In Review)
- **Verifier sub-agents with `readonly: true`** — they cannot set Status
- Execution setting Done or closing GitHub issues
- Pushing to `main`
- Lane P execution committing to `staging`
- Dispatching Lane P and Lane S in the same wave
- Blanket `git add .`
- Task commits without `[#N]` when GitHub sync in scope
- `fixes #<epic>` on non-final subtask
- Hand-written or edited committed DB migrations (`15-db-migrations-schema.mdc`)
- Checking "is issue on project" — see rule `12-github-project-board.mdc`
- Marking **Done** without `fixes #N` in `staging` git history for that issue
- Landing another issue's work without `fixes #N` for the source task (e.g. P2-05 schema via #47 without `fixes #41`)
