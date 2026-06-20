---
name: orchestrator
description: Run a chat as a pure orchestrator for PipeWatch. Reads the GitHub Issues board (project #5), presents a Lane S/P batch plan, then dispatches sub-agents immediately (unless user says wait). Verifies each task and syncs board Status to Done after every PASS. Sends a Slack DM to the configured operator (from cursor@mdg-labs.dev MCP auth) when the run ends. Epic or single issue — start without asking. Use when the user asks to orchestrate, delegate end-to-end, or implement a GitHub issue/epic.
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
- **Session-end Slack DM** to the configured **operator** via service-account MCP auth (see [Session-end Slack DM](#session-end-slack-dm-mandatory), [slack-notify.md](slack-notify.md))
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
**Epic linkage:** every child commit includes `[#<epic>]` in subject + `refs #<epic>` in body  
**CLOSE_PARENTS:** `fixes #5` on final child #36 only (in addition to `refs #5`)

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
7. **On stop:** update `workspace-notes.md` → [session-end Slack DM](#session-end-slack-dm-mandatory) → final summary in chat.

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

**Rule:** Board **Done** is insufficient. Every issue marked **Done** in a run must have `fixes #N` (or `fixes #<parent>` when appropriate) in **at least one commit on `staging`** that is part of the run's commit range (the task commit, a combined commit, or an explicit linkage commit). Epic children must also link the epic via subject `[#<parent>]` and body `refs #<parent>` (or `fixes #<parent>` on the final child).

**After every verifier PASS** and **before epic close**, the orchestrator **must** audit linkage:

```bash
# For each issue N marked Done in this run (leaves + parents per CLOSE_PARENTS):
git log <base>..staging --grep='fixes #N'
# base = commit before the orchestrator run started, or merge-base with origin/staging
# For each epic child with PARENT P, also confirm epic linkage:
git log <base>..staging --grep='refs #P'   # or --grep='\[#P\]' in subject
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

Each prompt includes (execution: **STATUS FIRST block must be the first lines** — see [prompt-templates.md](prompt-templates.md#status-first--mandatory-header-execution-only-paste-at-top-of-every-execution-task-prompt)):

1. **STATUS FIRST** (execution only) — filled GraphQL for In Progress on leaf (+ parent); pasted verbatim at top
2. **Task ID** — GitHub `#N`
3. **Acceptance criteria** — from issue body
4. **Doc references** — `prd §N`, `pages B*` from issue or [doc-index.md](doc-index.md)
5. READ / WRITE scope with absolute paths
6. Session ID: `<TASK-ID>-<YYYYMMDD>-<4hex>`
7. Lane (`S` or `P`) and git context
8. Epic context: `PARENT` (always mention in commits), `CLOSE_PARENTS` (final-child `fixes` only)
9. **GITHUB TOOLS** + **GITHUB SYNC** blocks — **full blocks, never one-line shorthand** ([prompt-templates.md](prompt-templates.md#prompt-compression-policy-mandatory))
10. **CI GATE (SHELL)** block in every execution and verifier prompt — include `WORK_ROOT`, `TURBO_FILTER` (verifier), `CI_PREFLIGHT_MODE`; `required_permissions: ["all"]` on first Shell attempt
11. **DB MIGRATIONS** block in every execution prompt

**After execution returns:** If output lacks `BOARD STATUS: In Progress` → treat as FAIL; re-dispatch with STATUS FIRST block or orchestrator sets In Progress before verifier.

**After verifier returns:** If output lacks `BOARD STATUS: Done` (on PASS) → orchestrator still runs board sync (existing rule).

## Resource management (CI preflight)

Long orchestrator runs can exhaust the user task limit (`fork: EAGAIN`) when Turbo fans out across the monorepo and Cursor sandbox children are not reaped. Mitigations live in `scripts/ci-preflight.sh`, `scripts/ci-gate.sh`, `scripts/ci-verify-scoped.sh`.

| Control | Purpose |
|---|---|
| `TURBO_CONCURRENCY=1` | One Turbo package task at a time per agent |
| `pnpm ci:preflight` | Scoped stale-process cleanup + pids warning |
| `pnpm ci:gate` | Execution full gate (sequential steps) |
| `pnpm ci:verify-scoped` | Verifier Layer 2 on one filter cone only |
| `WORK_ROOT` | Agent repo/worktree path — scopes preflight cleanup |
| `CI_PREFLIGHT_MODE=local` | Default; **parallel-safe** (Lane P) |
| `CI_PREFLIGHT_MODE=global` | Lane S serial only — prunes labeled test containers |

**Parallel Lane P safety:** Each parallel sub-agent gets its own `WORK_ROOT` (worktree path) and `TURBO_FILTER`. Preflight only kills turbo/vitest processes whose `/proc/PID/cwd` is under that agent's `WORK_ROOT`. **Never** use `CI_PREFLIGHT_MODE=global` or unscoped `pkill` while a Lane P batch is in flight — that would kill sibling agents' CI processes.

**Orchestrator between Lane S tasks:** May read `pids.current` via Shell. If above 60% of `pids.max` (~20k), pause dispatch and warn user, or instruct next agent to use `CI_PREFLIGHT_MODE=global` (serial only).

**Verifier Layer 2:** Scoped only — execution already ran `pnpm ci:gate`. Verifier runs `pnpm ci:verify-scoped` with task-specific `TURBO_FILTER`; do not rerun full monorepo lint/typecheck/unit.

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

**Lane P rules:** execution on `orchestrator/<TASK-ID>` only; never commit to `staging` during execution; `pnpm install` first in worktree; each agent sets `WORK_ROOT` to its worktree and `CI_PREFLIGHT_MODE=local`.

### Epic loop (orchestrator chat)

For each leaf in queue (until all Done or blocked):

```
dispatch execution → dispatch verifier (readonly: false)
→ on PASS: commit-linkage audit (fixes #N on staging) → board sync (Done + re-query)
→ on FAIL: stop or re-dispatch fix per user policy; do not advance queue
→ update workspace-notes.md
→ when queue empty or stopped: session-end Slack DM (see below)
```

## Session-end Slack DM (mandatory)

**When:** The orchestrator is about to stop — queue complete (all batches Done or skipped), epic finished, blocked with no further dispatch, or user explicitly ended the run (`plan only` does **not** trigger Slack).

**Skip only if:** user said `no slack` / `don't slack` / `skip slack`, or Slack MCP is unavailable.

**Sender vs recipient:** Slack MCP is connected as the **service account** `cursor@mdg-labs.dev` so operators receive push notifications. The authenticated MCP user is the **sender**, not the DM recipient. Full config: [slack-notify.md](slack-notify.md).

**Goal:** DM the **operator** (personal Slack user) from the service account. **Never** DM the authenticated service account to itself.

### Steps (last action before final user-visible summary)

1. **Read recipient** — [slack-notify.md](slack-notify.md) **Default operator** `user_id`, unless the run override applies (`slack to <email>` / `slack to <user_id>` in the orchestrator prompt).
   - If `user_id` missing: MCP `slack_search_users` with operator email from `slack-notify.md` only (not GitHub/git email).
   - If still unresolved → `SLACK_DM: SKIPPED (no operator recipient)`; do not fail the run.
2. **Sender sanity check (optional)** — MCP `slack_read_user_profile` (no `user_id`) should be `cursor@mdg-labs.dev`. If auth is a personal account, warn that notifications may not fire.
3. **Send DM** — MCP `plugin-slack-slack` → `slack_send_message`:
   - `channel_id`: operator **recipient** `user_id` (from step 1)
   - `message`: markdown summary (see template below)
4. **Confirm in chat** — `Slack DM sent to <operator name> (from cursor@mdg-labs.dev)` + permalink, or skip/fail reason.

### Message template

```markdown
**PipeWatch orchestrator — run complete**

**Target:** #<N> <title> | epic #<parent>
**Outcome:** complete | partial | blocked | failed

| Issue | Status | Commit |
|---|---|---|
| #50 | Done | `abc1234` |
| … | | |

**Staging:** <N> commits ahead of origin (not pushed) | pushed
**Blocked / follow-ups:** <none or bullets>
**Next suggested:** <from workspace-notes or queue>
```

Keep under ~500 words; link GitHub issues as `https://github.com/mdg-labs/pipewatch/issues/N`.

### Tool reference

| Step | MCP server | Tool |
|---|---|---|
| Operator recipient | [slack-notify.md](slack-notify.md) | default `user_id`; override per run |
| Recipient search fallback | `plugin-slack-slack` | `slack_search_users` (operator email only) |
| Sender check | `plugin-slack-slack` | `slack_read_user_profile` (no `user_id`) |
| Send DM | `plugin-slack-slack` | `slack_send_message` (`channel_id` = **operator** `user_id`) |

**Do not** use GitHub email / `git config user.email` for recipient resolution. **Do not** DM the authenticated MCP user when auth is `cursor@mdg-labs.dev`. **Do not** post to public channels — **operator DM only**.

## Execution agents

1. **Board Status (first Shell command):** GraphQL → **In Progress** on leaf + parent — paste **STATUS FIRST** block from [prompt-templates.md](prompt-templates.md); confirm `BOARD STATUS: In Progress` in output
2. **Session memory** in `active/<SESSION-ID>.md`
3. **Implementation**
4. **CI gate** — `WORK_ROOT=<path> CI_PREFLIGHT_MODE=<local|global> pnpm ci:gate` via Shell with `required_permissions: ["all"]` (see [CI GATE block](prompt-templates.md#ci-gate-shell--mandatory-in-every-execution-and-verifier-prompt))
5. **Pre-handoff:** Status → **In Review** (leaf); confirm `BOARD STATUS: In Review`; one implementation commit

Commit format: `[#N]` in subject (+ `[#<parent>]` when subtask); `fixes #N` in body; `refs #<parent>` on every subtask; `fixes #<parent>` per `CLOSE_PARENTS` (final child only).

## Verification agents (fresh thread per batch)

**Three layers (all must PASS):**

**Layer 1 — Scope:** committed paths vs WRITE SCOPE.

**Layer 2 — Scoped automated checks** (execution already ran full gate) — Shell **`required_permissions: ["all"]`** on first attempt:

```bash
WORK_ROOT=<repo-or-worktree> TURBO_FILTER=<filter> pnpm ci:verify-scoped
```

Orchestrator supplies `TURBO_FILTER` from primary WRITE SCOPE (see [prompt-templates.md](prompt-templates.md#ci-gate-shell--mandatory-in-every-execution-and-verifier-prompt)).

**Layer 3 — Logic review:**

- 3a. Each AC implemented?
- 3b. PRD `§` deviations with file:line + fix hint
- 3c. Security baseline (`03-security-baseline.mdc`)
- 3c2. Env vars fully registered (`05-env-vars.mdc`)
- 3c3. Commit linking (`07-issue-commit-linking.mdc`); when `PARENT` is set, subject includes `[#<parent>]` and body includes `refs #<parent>`; `CLOSE_PARENTS` alignment for `fixes #<parent>`; **`git log staging --grep='fixes #N'` must hit** for the task issue (and combined commits must list every covered `#N`)
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
- **Condensed GITHUB SYNC one-liners** (`In Progress #N → In Review → commit …`) — sub-agents skip board updates; use **STATUS FIRST** + full GITHUB SYNC blocks
- **Execution prompts without STATUS FIRST as the first section** — In Progress must be the agent's first Shell command
- **Accepting execution output without `BOARD STATUS: In Progress`** — re-dispatch or orchestrator sets status before verifier
- **Trusting verifier PASS text** without orchestrator board re-query (leaves stuck In Review)
- **Verifier sub-agents with `readonly: true`** — they cannot set Status
- Execution setting Done or closing GitHub issues
- Pushing to `main`
- Lane P execution committing to `staging`
- Dispatching Lane P and Lane S in the same wave
- Blanket `git add .`
- Task commits without `[#N]` when GitHub sync in scope
- Subtask commit missing `[#<epic>]` in subject or `refs #<epic>` in body when `PARENT` is set
- `fixes #<epic>` on non-final subtask (use `refs #<epic>` instead)
- Hand-written or edited committed DB migrations (`15-db-migrations-schema.mdc`)
- Checking "is issue on project" — see rule `12-github-project-board.mdc`
- Marking **Done** without `fixes #N` in `staging` git history for that issue
- Landing another issue's work without `fixes #N` for the source task (e.g. P2-05 schema via #47 without `fixes #41`)
- Running pnpm/gh/docker/CI commands in the **default sandbox** (causes spurious failures — use `required_permissions: ["all"]` first)
- **Global `pkill` or `CI_PREFLIGHT_MODE=global` during Lane P parallel batch** — kills sibling agents' CI processes
- **Verifier rerunning full monorepo** `pnpm lint && typecheck && test:unit` when execution already passed `pnpm ci:gate`
- Ending an orchestrator run **without** session-end Slack DM (unless user opted out or recipient unresolved)
- DMing the **authenticated MCP user** when auth is the service account (`cursor@mdg-labs.dev`) — always DM the **operator** per [slack-notify.md](slack-notify.md)
- Resolving Slack DM recipient via GitHub/git email instead of **slack-notify.md** / run override / operator email search
- Posting orchestrator summaries to **public Slack channels** instead of operator DM
