# Orchestrator — Sub-agent prompt templates

Copy and fill. Sub-agents do not see the orchestrator chat.

Include **role-specific** GITHUB SYNC blocks from [github-board.md](github-board.md).

**Every execution and verifier prompt** must include **GITHUB TOOLS**, **NODE ENV**, **CI GATE (SHELL)**, and (execution only) **DB MIGRATIONS** blocks below.

**Orchestrator dispatch rules:**

- **Any GitHub target** (single leaf or epic) → build batch plan, **show plan to user**, then start batch 1 immediately (unless user said `plan only` / `wait` / `don't start`).
- **Every Task prompt** (execution + verifier) → include the **CI GATE (SHELL)** block verbatim; sub-agents must use `required_permissions: ["all"]` on first Shell attempt.
- **Verifier Task** → `readonly: false` always (needs GraphQL Status mutations).
- After verifier PASS → orchestrator runs [board sync](github-board.md#orchestrator--after-every-verifier-pass-mandatory) regardless of verifier output.

## Prompt compression policy (mandatory)

Sub-agents do **not** read `github-board.md` or this file unless you paste the relevant blocks into the Task prompt. **Never** replace full GITHUB SYNC blocks with one-line shorthands.

| ❌ Forbidden (agents skip board updates) | ✅ Required |
|---|---|
| `GITHUB SYNC: In Progress #143+#141 → In Review → commit …` | Full **STATUS FIRST** block (below) with issue numbers filled in |
| `GITHUB SYNC: (see github-board.md)` | Inline GraphQL commands with `<N>` replaced |
| GITHUB SYNC buried after AC / CI / scope | **STATUS FIRST** is the **first section** of every execution prompt |
| No board-status lines in REQUIRED OUTPUT | `BOARD STATUS: …` required in execution output |

### Execution prompt section order (mandatory)

Orchestrator **must** assemble execution Task prompts in this order — no exceptions:

1. **STATUS FIRST** — filled GraphQL for In Progress (leaf + parent); `FIRST SHELL COMMAND` rule
2. **GITHUB SYNC — EXECUTION** — full block from [github-board.md](github-board.md#execution-variant)
3. **GITHUB TOOLS** — GraphQL IDs + forbidden ops
4. MODE / LANE / TASK / SESSION / PARENT / CLOSE_PARENTS
5. ACCEPTANCE CRITERIA + DOC REFERENCE + READ/WRITE SCOPE
6. **CI GATE (SHELL)** + **DB MIGRATIONS** (execution only)
7. WORK steps + **REQUIRED OUTPUT** (includes board status confirmation)

Verifier prompts: **GITHUB SYNC — VERIFIER** + **GITHUB TOOLS** before VERIFY steps (same rule — never one-line shorthand).

---

## Orchestrator — batch plan + run loop

```text
TARGET: #<N> | epic #<parent> | phase P1
PAUSE: only if user said plan only / wait / don't start

1. Load issues + board Status + deps
2. OUTPUT batch plan table (Lane S/P per batch) — BEFORE first Task dispatch
3. Dispatch batch 1 execution agent(s)
4. Verifier(s) — readonly: FALSE
5. Orchestrator board sync on PASS
6. Next batch until queue empty or FAIL

EPIC example:
| Batch | Lane | Issues |
| 1 | S | #31 |
| 2 | S | #32 |
| 3 | S | #33, #34, #35 |  # serialized if shared index.ts
| 4 | S | #36 | CLOSE_PARENTS: [#5]

SINGLE LEAF example:
| Batch | Lane | Issues |
| 1 | S | #42 |
```

## GITHUB TOOLS — mandatory in every GITHUB SYNC prompt

```text
GITHUB TOOLS — MANDATORY:
- MCP server: user-github
- Issue create/update: MCP issue_write (type, labels, Priority, Effort, assignees, milestone — all mandatory on create)
- Issue read: MCP issue_read
- Comments: MCP add_issue_comment
- Sub-issues: MCP sub_issue_write (database IDs via GraphQL)
- Search/list: MCP search_issues / list_issues

PROJECT STATUS — GraphQL only (project #5):
- Project node ID: PVT_kwDODv-LLc4Ba3QP
- Status field ID: PVTSSF_lADODv-LLc4Ba3QPzhVryEg
- Options: Backlog=9485f8e2, Ready=a0e7153f, In Progress=47fc9ee4, In Review=81f76819, Done=98236657, Closed=99be8811, Declined=e36e1062
- Roadmap map: docs/internal/github-roadmap-issue-map.json (databaseId + node_id per task)
- Default milestone: MVP #1; org Effort/Priority via issue_fields (see github-board.md)

Step 1 — item ID:
  gh api graphql -f 'query=query { repository(owner:"mdg-labs",name:"pipewatch") { issue(number:N) { projectItems(first:10) { nodes { id project { number } } } } } }'
  → filter project.number == 5

Step 2 — set Status:
  gh api graphql -f 'query=mutation { updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwDODv-LLc4Ba3QP" itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lADODv-LLc4Ba3QPzhVryEg"
    value: { singleSelectOptionId: "<OPTION_ID>" }
  }) { projectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } }'

FORBIDDEN:
- gh issue create/edit (use MCP)
- gh project item-list / item-edit
- Checking "is issue in project" (rule 12-github-project-board.mdc)
- Setting GitHub issue open/closed — board Status only
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

**Root causes addressed:** (1) Default Cursor sandbox blocks Docker/`gh`. (2) Turbo parallel fan-out + stale agent processes exhaust user task limits (`fork: EAGAIN`) on long orchestrator runs.

```text
CI GATE (SHELL) — MANDATORY:
- NEVER run pnpm, gh, docker, or CI gate commands in the default sandbox
- ALWAYS invoke Shell with required_permissions: ["all"] on the FIRST attempt
- Do NOT "try sandbox first" and retry — start outside sandbox
- Repo root: /home/mdguggenbichler/projects/pipewatch
- ALWAYS export TURBO_CONCURRENCY=1 (scripts set this; do not override upward)
- ALWAYS run preflight before CI (scripts call it automatically)

PARALLEL-SAFE PREFLIGHT (mandatory — do not use global pkill):
- WORK_ROOT = agent repo/worktree absolute path (Lane S: repo root; Lane P: worktree path)
- CI_PREFLIGHT_MODE=local — default; cleans turbo/vitest only under WORK_ROOT (Lane P parallel OK)
- CI_PREFLIGHT_MODE=global — Lane S serial only; also prunes labeled integration containers
- FORBIDDEN during Lane P parallel batch: CI_PREFLIGHT_MODE=global, pkill -f turbo/vitest without WORK_ROOT scoping

Execution — full gate before commit (.cursor/rules/06-local-ci-before-commit.mdc):
  WORK_ROOT=<repo-or-worktree> CI_PREFLIGHT_MODE=<local|global> pnpm ci:gate
  (runs lint, typecheck, test:unit, build, test:integration, audit sequentially with TURBO_CONCURRENCY=1)

Verifier — Layer 2 scoped (execution already ran full gate; do NOT rerun whole monorepo):
  WORK_ROOT=<repo-or-worktree> TURBO_FILTER=<filter> pnpm ci:verify-scoped
  (preflight + turbo lint/typecheck/test:unit for filter cone only)

TURBO_FILTER — derive from primary WRITE SCOPE package (orchestrator fills in prompt):
| Primary path prefix        | TURBO_FILTER          |
| apps/api/                  | @pipewatch/api...     |
| apps/worker/               | @pipewatch/worker...  |
| apps/web/                  | @pipewatch/web...     |
| apps/marketing/            | @pipewatch/marketing... |
| packages/ui/               | @pipewatch/ui...      |
| packages/db/               | @pipewatch/db...      |
| packages/types/            | @pipewatch/types...   |
| packages/utils/            | @pipewatch/utils...   |
| packages/config/           | @pipewatch/config...  |
| Multiple packages touched  | filter of primary app + ... (dependency cone) |

Also use required_permissions: ["all"] for:
- pnpm install / pnpm ci:gate / pnpm ci:verify-scoped / pnpm ci:preflight
- gh api graphql (board Status mutations)
- phase run --env=Development -- …
- Any command that starts containers, binds ports, or calls GitHub

If fork/EAGAIN or "Resource temporarily unavailable" after ["all"]: report blocked with user pids.current; do not retry in a loop.
If a command fails with sandbox/network/Docker errors after using ["all"], report blocked — do not loop sandbox retries.
```

---

## DB MIGRATIONS — mandatory in every execution prompt

```text
DB MIGRATIONS — MANDATORY (see .cursor/rules/15-db-migrations-schema.mdc):
- Schema in packages/db/schema/ is source of truth — if not in schema, it does not exist
- Workflow: edit schema → pnpm db:generate (Drizzle Kit) → commit schema + generated migration together
- FORBIDDEN: hand-written SQL, hand-created migration dirs, editing/deleting committed migrations, drizzle-kit push
- If Drizzle Kit cannot run → report blocked; do NOT hand-write SQL
```

---

## STATUS FIRST — mandatory header (execution only; paste at top of every execution Task prompt)

Orchestrator **fills in issue numbers** and **pastes this block first** — before MODE, AC, CI, or scope. Sub-agent's **first Shell command** must be one of these GraphQL mutations (or the batch variant).

```text
⚠️ STATUS FIRST — MANDATORY (before session memory, before Read/Grep, before any code)

Your FIRST action is board Status → In Progress. Do NOT read files, write code, or create session memory until board Status is In Progress on every issue listed below.

Issues to update now: #<LEAF> [+ #<PARENT> if subtask]

Step 1 — get project item IDs (Shell, required_permissions: ["all"]):
  gh api graphql -f 'query=query { repository(owner:"mdg-labs",name:"pipewatch") { issue(number:<LEAF>) { projectItems(first:10) { nodes { id project { number } } } } } }'
  # repeat for parent #<PARENT> if not none

Step 2 — set In Progress (option ID 47fc9ee4) for EACH issue:
  gh api graphql -f 'query=mutation { updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwDODv-LLc4Ba3QP" itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lADODv-LLc4Ba3QPzhVryEg"
    value: { singleSelectOptionId: "47fc9ee4" }
  }) { projectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } }'

Step 3 — confirm in output: BOARD STATUS: In Progress on #<LEAF> [and #<PARENT>]

If GraphQL fails → report BOARD_SYNC: FAILED and stop (do not implement until fixed).

Pre-handoff (after CI gate, before returning): repeat Steps 1–2 with In Review (option ID 81f76819) on leaf #<LEAF> only; confirm BOARD STATUS: In Review on #<LEAF>.
```

**Batch shortcut** (2+ issues, same Status): one mutation with `items: [{ itemId, fieldId, value }, …]` is OK after fetching all item IDs.

### BAD vs GOOD (orchestrator — do not dispatch the BAD prompt)

```text
# ❌ BAD — agents skip board updates
MODE: GitHub | Lane S | TASK #143 | PARENT #141
GITHUB SYNC: In Progress #143+#141 → In Review → commit feat(runs)[#143] …
CI: required_permissions ["all"]; pnpm ci:gate
ACCEPTANCE CRITERIA: …

# ✅ GOOD — STATUS FIRST block pasted verbatim with #143 and #141 filled in, then full GITHUB SYNC — EXECUTION block, then rest
```

---

## Execution agent — Lane S (serial on staging)

```text
⚠️ STATUS FIRST — (paste filled block from section above — MUST be first lines of prompt)

GITHUB SYNC — EXECUTION:
- MCP server: user-github
- owner: mdg-labs | repo: pipewatch | project: 5
- issues: [{ number: <N> }, { number: <parent> }]  # parent omitted if none
- CLOSE_PARENTS: [#<parent>] | none
- FIRST ACTION: GraphQL Status → In Progress (all listed) — BEFORE session memory or code
- LAST ACTIONS: session ended → Status → In Review (leaf only) → single commit
- FORBIDDEN: Status → Done; verification comments; committing session memory
- COMMIT: [#<N>] in subject; fixes #<N> in body; fixes parents per CLOSE_PARENTS

GITHUB TOOLS — MANDATORY:
(paste GITHUB TOOLS block from top of this file)

MODE: GitHub
LANE: S
TARGET REPO: /home/mdguggenbichler/projects/pipewatch
WORK BRANCH: staging
TASK ID: #<N>
SESSION ID: #<N>-<YYYYMMDD>-<4hex>
PARENT: #<parent> | none
CLOSE_PARENTS: [#<parent>] | none

CI GATE (SHELL): (see prompt-templates.md — required_permissions: ["all"], never sandbox)

DB MIGRATIONS — MANDATORY:
(paste DB MIGRATIONS block from top of this file)

ACCEPTANCE CRITERIA:
- <from issue body>

DOC REFERENCE:
- prd §<N>
- pages <section>

READ SCOPE:
- <paths>

WRITE SCOPE:
- <paths>

SESSION MEMORY: .cursor/skills/agent-memory/active/<SESSION-ID>.md

WORK:
1. STATUS FIRST — In Progress (GraphQL; confirm BOARD STATUS in output)
2. Session memory start + pnpm install if needed
3. Implement per AC
4. Full CI gate: WORK_ROOT=<repo> CI_PREFLIGHT_MODE=<local|global> pnpm ci:gate
5. Pre-handoff: In Review (leaf) → single commit with [#N] + fixes lines

REQUIRED OUTPUT (all fields mandatory):
- BOARD STATUS: In Progress on #<N> [and parent] — set at start
- BOARD STATUS: In Review on #<N> — set before handoff (or BOARD_SYNC: FAILED)
- Session ID, commit SHA, files changed, status: complete | blocked
```

---

## Verifier — Lane S

```text
GITHUB SYNC — VERIFIER:
- project: 5
- issues: [{ number: <N> }]
- CLOSE_PARENTS: [#<parent>] | none
- DISPATCH: readonly MUST be false (GraphQL Status mutations)
- AFTER PASS: comment → Status → Done → re-query and report actual Status in output
- AFTER FAIL: FAIL comment → Status → Ready
- Orchestrator re-syncs Done after PASS regardless (see github-board.md)

GITHUB TOOLS — MANDATORY:
(paste GITHUB TOOLS block from top of this file)

MODE: GitHub verify
LANE: S
TARGET REPO: /home/mdguggenbichler/projects/pipewatch
TASK ID: #<N>
SESSION ID: <same as execution>
CLOSE_PARENTS: [#<parent>] | none

DISPATCH NOTE: Orchestrator must launch this agent with readonly: FALSE.

CI GATE (SHELL): (see prompt-templates.md — required_permissions: ["all"], never sandbox)

TURBO_FILTER: <from WRITE SCOPE — see CI GATE table>

VERIFY:
- Layer 1: scope audit
- Layer 2: WORK_ROOT=<repo-or-worktree> TURBO_FILTER=<filter> pnpm ci:verify-scoped (scoped; do NOT rerun full monorepo)
- Layer 3: AC, PRD contract, security, env vars, commit linking, migration policy (`15-db-migrations-schema.mdc`)
- Layer 3c3 (mandatory): `git log staging --grep='fixes #<N>'` must return at least one commit for task #<N> (combined commits must list every covered issue on separate `fixes #N` lines)

AFTER PASS (mandatory before returning):
1. add_issue_comment with PASS summary
2. GraphQL Status → Done (option ID 98236657) on leaf (#<N>)
3. If CLOSE_PARENTS: GraphQL Status → Done on each parent
4. Re-query Status; include actual board Status in output (not assumed)

REQUIRED OUTPUT (all fields mandatory):
- PASS | FAIL with layer detail and fix hints
- BOARD STATUS: <actual Status after your mutation> on #<N> (and parents if applicable)
- If GraphQL failed: report BOARD_SYNC: FAILED — orchestrator will retry
```

---

## Execution agent — Lane P (isolated branch)

Same as Lane S except — **STATUS FIRST block still required at top** (In Progress on leaf + parent before worktree setup):

```text
LANE: P
WORK BRANCH: orchestrator/<TASK-ID>
WORKTREE: ../pipewatch-wt-<TASK-ID>
STAGING_BASE_SHA: <sha at batch start>

FORBIDDEN: checkout staging, merge, push during execution
FIRST SHELL AFTER STATUS: pnpm install in worktree (still after In Progress GraphQL)
WORK_ROOT: <worktree absolute path> — use for all ci:preflight / ci:gate / ci:verify-scoped
CI_PREFLIGHT_MODE: local — mandatory during Lane P parallel (never global while siblings run)
TURBO_FILTER: <from WRITE SCOPE — per-task filter; each parallel agent uses its own>
```

---

## Orchestrator — pre-dispatch checklist (every Task call)

Before `Task` tool for execution:

- [ ] **STATUS FIRST** block pasted first with `#N` and parent filled in
- [ ] Full **GITHUB SYNC — EXECUTION** block (not one-line shorthand)
- [ ] **GITHUB TOOLS** block included
- [ ] **CI GATE** + **DB MIGRATIONS** blocks included
- [ ] `readonly: false` on verifier dispatches

After execution returns:

- [ ] Output contains `BOARD STATUS: In Progress on #N` — if missing, do not dispatch verifier until fixed
