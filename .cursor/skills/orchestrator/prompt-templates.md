# Orchestrator — Sub-agent prompt templates

Copy and fill. Sub-agents do not see the orchestrator chat.

Include **role-specific** LINEAR SYNC blocks from [linear-board.md](linear-board.md).

**Every execution and verifier prompt** must include **LINEAR TOOLS**, **NODE ENV**, **CI GATE (SHELL)**, and (execution only) **DB MIGRATIONS** blocks below.

**Orchestrator dispatch rules:**

- **Any Linear target** (single leaf or epic) → build batch plan with **`PW-N`**, show plan, start batch 1 (unless user said `plan only` / `wait`)
- **Every Task prompt** → **CI GATE (SHELL)** block; `required_permissions: ["all"]` on first Shell attempt
- **Verifier Task** → `readonly: false` always (Linear MCP status + comments)
- After verifier PASS → orchestrator runs [board sync](linear-board.md#status-sync--sub-agent-duties--orchestrator-guarantee)

## Prompt compression policy (mandatory)

Sub-agents do **not** read `linear-board.md` or this file unless you paste blocks into the Task prompt. **Never** one-line LINEAR SYNC shorthands.

| ❌ Forbidden | ✅ Required |
|---|---|
| `LINEAR SYNC: In Progress PW-143 → In Review → commit …` | Full **STATUS FIRST** block with `PW-N` filled in |
| `LINEAR SYNC: (see linear-board.md)` | Inline MCP steps with IDs replaced |
| STATUS FIRST buried after AC / CI | **STATUS FIRST** is **first section** of every execution prompt |

### Execution prompt section order (mandatory)

1. **STATUS FIRST** — In Progress via `save_issue` (leaf + parent)
2. **LINEAR SYNC — EXECUTION** — full block from [linear-board.md](linear-board.md#linear-sync-blocks)
3. **LINEAR TOOLS**
4. **COMMIT LINK** — `#N` resolved from `get_issue` attachments
5. MODE / LANE / TASK / SESSION / PARENT / CLOSE_PARENTS
6. ACCEPTANCE CRITERIA + DOC REFERENCE + READ/WRITE SCOPE
7. **CI GATE (SHELL)** + **DB MIGRATIONS**
8. WORK steps + **REQUIRED OUTPUT**

---

## Orchestrator — batch plan + run loop

```text
TARGET: PW-<N> | epic PW-<parent>
PAUSE: only if user said plan only / wait / don't start

1. Load issues via get_issue / list_issues(parentId) + status + deps
2. OUTPUT batch plan table (PW-N only) — BEFORE first Task dispatch
3. Dispatch batch 1 execution agent(s)
4. Verifier(s) — readonly: FALSE
5. Orchestrator board sync on PASS + commit-linkage audit (fixes #N)
6. Next batch until queue empty or FAIL

EPIC example:
| Batch | Lane | Issues |
| 1 | S | PW-31 |
| 2 | S | PW-32 |

COMMIT LINK (execution only, not in plan table):
- PW-31 → #31; epic PW-5 → #5 for refs/fixes on final child
```

---

## LINEAR TOOLS — mandatory in every LINEAR SYNC prompt

```text
LINEAR TOOLS — MANDATORY:
- MCP server: plugin-linear-linear
- Read: get_issue (includeRelations for blockers)
- List children: list_issues with parentId
- Create/update: save_issue (state, labels, parentId, blockedBy)
- Comments: save_comment with parentId = GitHub-synced thread root (list_comments first)

COMMIT RESOLVE (before git commit — never user-github):
- get_issue(PW-N) → attachments[].url → GitHub #N
- Example: PW-222 → #244

FORBIDDEN:
- user-github issue_read, issue_write, search_issues, add_issue_comment
- GraphQL updateProjectV2ItemFieldValue (GitHub Project #5)
- fixes PW-N or [#PW-N] in commits
- Top-level save_comment for operational output
```

---

## NODE ENV — mandatory before pnpm/turbo

```text
NODE ENV:
- Pin: .nvmrc (match CI Node version when present)
- Run pnpm commands from repo root via Turborepo
- Integration: pnpm test:integration uses ephemeral Postgres+Redis only — never Neon
- Optional secrets: phase run --env=Development -- pnpm …
```

---

## CI GATE (SHELL) — mandatory in every execution and verifier prompt

```text
CI GATE (SHELL) — MANDATORY:
- NEVER run pnpm, gh, docker, or CI gate commands in the default sandbox
- ALWAYS invoke Shell with required_permissions: ["all"] on the FIRST attempt
- Repo root: /home/mdguggenbichler/projects/pipewatch
- ALWAYS export TURBO_CONCURRENCY=1

Execution — full gate before commit:
  WORK_ROOT=<repo-or-worktree> CI_PREFLIGHT_MODE=<local|global> pnpm ci:gate

Verifier — Layer 2 scoped:
  WORK_ROOT=<repo-or-worktree> TURBO_FILTER=<filter> pnpm ci:verify-scoped

Also use required_permissions: ["all"] for:
- pnpm ci:gate / ci:verify-scoped / ci:preflight
- phase run --env=Development -- …
- gh api (Dependabot only — not issue board)
```

---

## DB MIGRATIONS — mandatory in every execution prompt

```text
DB MIGRATIONS — MANDATORY (see .cursor/rules/15-db-migrations-schema.mdc):
- Schema in packages/db/schema/ is source of truth
- Workflow: edit schema → pnpm db:generate → commit schema + migration together
- FORBIDDEN: hand-written SQL, editing committed migrations, drizzle-kit push
```

---

## STATUS FIRST — mandatory header (execution only)

Orchestrator **fills in `PW-N`** and pastes this block **first**.

```text
⚠️ STATUS FIRST — MANDATORY (before session memory, before Read/Grep, before any code)

Your FIRST actions:
1. get_issue PW-<LEAF> [+ PW-<PARENT>] → record COMMIT LINK (#N from attachments)
2. save_issue { id: "PW-<LEAF>", state: "In Progress" }
3. save_issue { id: "PW-<PARENT>", state: "In Progress" }  # if subtask
4. Output: BOARD STATUS: In Progress on PW-<LEAF> [and PW-<PARENT>]

If save_issue fails → BOARD_SYNC: FAILED and stop.

Pre-handoff: save_issue PW-<LEAF> state "In Review"; confirm BOARD STATUS: In Review on PW-<LEAF>
```

---

## COMMIT LINK — mandatory in execution prompts

Orchestrator resolves or instructs execution to resolve before commit:

```text
COMMIT LINK (from get_issue attachments):
- Leaf: PW-<LEAF> → GitHub #<N>
- Parent: PW-<PARENT> → GitHub #<P>  # if subtask

COMMIT FORMAT (GitHub numbers only):
- Subject: [#<N>] (+ [#<P>] when subtask)
- Body: fixes #<N>; refs #<P> on subtasks; fixes #<P> per CLOSE_PARENTS (final child only)
- FORBIDDEN: fixes PW-N, [PW-N] in git
```

---

## Execution agent — Lane S (serial on staging)

```text
⚠️ STATUS FIRST — (paste filled block — MUST be first lines)

LINEAR SYNC — EXECUTION:
(paste full block from linear-board.md)

LINEAR TOOLS — MANDATORY:
(paste LINEAR TOOLS block)

COMMIT LINK:
- PW-<N> → #<N>
- PW-<parent> → #<P> | none

MODE: Linear
LANE: S
TARGET REPO: /home/mdguggenbichler/projects/pipewatch
WORK BRANCH: staging
TASK ID: PW-<N>
SESSION ID: PW-<N>-<YYYYMMDD>-<4hex>
PARENT: PW-<parent> | none
CLOSE_PARENTS: [PW-<parent>] | none

CI GATE (SHELL): required_permissions ["all"]

DB MIGRATIONS — MANDATORY:
(paste DB MIGRATIONS block)

ACCEPTANCE CRITERIA:
- <from issue description>

DOC REFERENCE:
- prd §<N>

READ SCOPE / WRITE SCOPE:
- <paths>

WORK:
1. STATUS FIRST + COMMIT LINK
2. Session memory + implement
3. pnpm ci:gate
4. In Review → commit with [#N] / fixes #N

REQUIRED OUTPUT:
- BOARD STATUS: In Progress on PW-<N>
- BOARD STATUS: In Review on PW-<N>
- COMMIT LINK used: #<N>
- commit SHA, status: complete | blocked
```

---

## Verifier — Lane S

```text
LINEAR SYNC — VERIFIER:
(paste full block from linear-board.md)

LINEAR TOOLS — MANDATORY:
(paste LINEAR TOOLS block)

COMMIT LINK:
- PW-<N> → #<N> (for Layer 3c3 audit)

MODE: Linear verify
TASK ID: PW-<N>
CLOSE_PARENTS: [PW-<parent>] | none
readonly: FALSE

TURBO_FILTER: <from WRITE SCOPE>

VERIFY:
- Layer 1: scope
- Layer 2: pnpm ci:verify-scoped
- Layer 3: AC, PRD, security, env vars, commit linking, migrations
- Layer 3c3: git log staging --grep='fixes #<N>' (N from COMMIT LINK)

AFTER PASS:
1. save_comment in synced thread
2. save_issue state Done (leaf + CLOSE_PARENTS parents)
3. Re-query get_issue; report actual status

REQUIRED OUTPUT:
- PASS | FAIL
- BOARD STATUS: <actual> on PW-<N>
```

---

## Execution agent — Lane P

Same as Lane S except:

```text
LANE: P
WORK BRANCH: orchestrator/PW-<N>
WORKTREE: ../pipewatch-wt-PW-<N>
WORK_ROOT: <worktree path>
CI_PREFLIGHT_MODE: local
```

---

## Orchestrator — pre-dispatch checklist

Before execution Task:

- [ ] **STATUS FIRST** with `PW-N` filled in
- [ ] Full **LINEAR SYNC — EXECUTION**
- [ ] **COMMIT LINK** block (or instruct get_issue at start)
- [ ] **CI GATE** + **DB MIGRATIONS**
- [ ] Verifier `readonly: false`

After execution:

- [ ] Output contains `BOARD STATUS: In Progress on PW-N`
