# Linear migration — replace GitHub Projects & Issues for agents

**Date:** 2026-06-29 (updated)  
**Scope:** Migrate PipeWatch **task tracking** from GitHub Issues + Projects v2 to **Linear** (`plugin-linear-linear` MCP). After migration, orchestrator, intake, triage, and all agent workflows use **Linear issue keys only** (`PW-123`).

---

## Target state (what we are building toward)

| Layer | System | Agent / human reference |
|---|---|---|
| **Task board & issues** | Linear (`PW-*`) | **Only** `PW-123`, Linear URLs, team key `PW` |
| **Status workflow** | Linear issue `state` | Backlog → Ready → In Progress → In Review → Done |
| **Epics & dependencies** | Linear `parentId`, `blockedBy` | `PW-215` parent; `blockedBy: ["PW-216"]` |
| **Agent comments** | Linear synced thread | `save_comment` + `parentId` (mirrors to linked GitHub) |
| **Commits (git)** | GitHub issue **`#N`** | `[#N]` in subject, `fixes #N` in body — **unchanged**; resolve `#N` from Linear before commit |
| **User invokes skills** | — | `orchestrate PW-5`, `intake …`, `triage PW-12` — **never** `#N` in prompts |

### What GitHub is still used for (not task tracking)

GitHub remains the **code host** only. Agents do **not** read, create, update, or close GitHub Issues for PipeWatch work.

| Still on GitHub | Not used by agents for tasks |
|---|---|
| `mdg-labs/pipewatch` repo, PRs, CI, branches | ❌ GitHub Project #5 |
| Dependabot alert **fetch** (`gh api`) | ❌ `issue_read` / `issue_write` / `search_issues` |
| Linear↔GitHub **bidirectional sync** | Creates/links mirrored `#N` on `mdg-labs/pipewatch` | ❌ Manual GitHub issue CRUD by agents |
| Commit auto-close on merge to `main` | `fixes #N` (resolved from Linear) | ❌ `#N` in orchestrator prompts or batch plans |
| Comment mirror via synced thread | Background visibility on linked `#N` | ❌ GraphQL board Status |

Every Linear issue (`PW-*`) has a **linked GitHub issue** (`#N`) via sync. Agents use **`PW-N` for all task work** and resolve **`#N` only at commit time** — they do not dispatch work by GitHub number.

---

## Operating mode (post-MVP — June 2026)

The **phased MVP roadmap** (P0–P21 epics, bulk GitHub intake, `github-roadmap-issue-map.json`) is **complete**. Day-to-day work is no longer roadmap-driven.

| Work type | Typical flow |
|---|---|
| **Bug fix** | `triage PW-N` or `linear-intake` → single **Bug** → `implement PW-N` or orchestrator for verify gate |
| **Small improvement** | Single **Task** — no epic unless scope grows |
| **Iteration / feature slice** | One task or small epic (2–5 children) when genuinely multi-step |
| **Dependabot / security** | Alert → Linear Bug via dependabot-triage or security-audit → implement |

**Default orchestrator target:** one **`PW-N`** issue the operator names — not "run phase P12" or sweep an epic queue. Epics remain valid when a feature genuinely needs parent + children; they are not the default planning unit.

**Retired (do not reintroduce):** `pipewatch-development-roadmap.md` bulk sync, `github-intake-from-roadmap.py`, phase-key → issue maps, "orchestrate entire epic P*" unless operator explicitly asks.

---

## Executive summary

| Question | Answer |
|---|---|
| Replace GitHub Projects + Issues for agents? | **Yes — full replacement.** Linear is the only task system for orchestrator, intake, triage, verifier, and operator prompts. |
| What do humans/agents reference? | **Linear keys only:** `PW-123`, epic `PW-5`, project **PipeWatch Roadmap**. No `#N` in skill invocations or agent prompts. |
| Can we drop GitHub entirely? | **No** — repo, CI, Dependabot alert source, and Linear↔GitHub sync stay on GitHub. Issue **tracking** moves off GitHub. |
| Is work already started? | **MVP roadmap complete.** Linear team `PW-*` active; skills cut over. Legacy GitHub Project #5 and bulk roadmap artefacts are **retired**. |
| Agent comments visible on GitHub? | **Via Linear only** — reply in the GitHub-synced thread on each linked Linear issue ([Comment sync policy](#comment-sync-policy-linear--github)). Never `add_issue_comment`. |
| Commit convention | **`[#N]`** subject + **`fixes #N`** body — **keep existing** `07-issue-commit-linking.mdc`; resolve `#N` from Linear (`get_issue` → GitHub attachment) |

---

## Linear MCP — full tool inventory (45 tools)

MCP server: `plugin-linear-linear`  
Instructions: pass markdown strings with **literal newlines** (no `\n` escape sequences).

### Issues (core board operations)

| Tool | Purpose | Key parameters |
|---|---|---|
| `list_issues` | Search/filter issues | `team`, `state`, `project`, `label`, `assignee`, `parentId`, `query`, `priority`, `cycle`, `release`, pagination |
| `get_issue` | Full issue detail | `id` (e.g. `PW-123`), `includeRelations`, `includeReleases`, `includeCustomerNeeds` |
| `save_issue` | Create or update issue | `title`, `team`, `description`, `state`, `project`, `labels`, `priority`, `assignee`, `parentId`, `blockedBy`, `blocks`, `relatedTo`, `duplicateOf`, `estimate`, `milestone`, `cycle`, `links`, `releases` |
| `list_issue_statuses` | Team workflow states | `team` (required) |
| `get_issue_status` | Status detail | `id`, `name`, `team` (all required per schema) |

### Comments & attachments

| Tool | Purpose |
|---|---|
| `list_comments` | Threads on issue/project/initiative/document/milestone |
| `save_comment` | Create/update comment or reply (`parentId` for threads) |
| `delete_comment` | Delete comment (inline description comments have restrictions) |
| `prepare_attachment_upload` | Signed URL for direct file PUT |
| `create_attachment_from_upload` | Finalize upload after PUT |
| `create_attachment` | Deprecated base64 upload (avoid) |
| `delete_attachment` | Remove attachment |
| `get_attachment` | Attachment metadata |
| `extract_images` | Extract images from content |

### Labels

| Tool | Purpose |
|---|---|
| `list_issue_labels` | Workspace/team issue labels |
| `create_issue_label` | Create label (optional `teamId`, `parent` group) |
| `list_project_labels` | Project-level labels |

### Projects, milestones, initiatives

| Tool | Purpose |
|---|---|
| `list_projects` | Filter by team, state, initiative, member, label |
| `get_project` | Project detail (+ milestones, members, resources) |
| `save_project` | Create/update project, teams, initiatives, dates |
| `list_milestones` | Milestones within a project |
| `get_milestone` | Single milestone |
| `save_milestone` | Create/update milestone |
| `save_status_update` | Project/initiative health update (`onTrack` / `atRisk` / `offTrack`) |
| `get_status_updates` | List/get status updates |
| `delete_status_update` | Remove status update |

### Teams, users, cycles

| Tool | Purpose |
|---|---|
| `list_teams` | All teams |
| `get_team` | Team by UUID, key, or name |
| `list_users` | Workspace users (filter by team) |
| `get_user` | User by ID, name, email, or `"me"` |
| `list_cycles` | Sprint cycles (`current`, `previous`, `next`) |

### Documents

| Tool | Purpose |
|---|---|
| `list_documents` | Filter by project, initiative, team |
| `get_document` | Document by ID/slug |
| `save_document` | Create/update; parent: project, issue, initiative, cycle, or team |

### Releases & code review (Linear-native)

| Tool | Purpose |
|---|---|
| `list_release_pipelines` | Release pipelines |
| `list_releases` | Releases with stage/version filters |
| `get_release` | Release detail |
| `save_release` | Create/update release (`commitSha` supported) |
| `list_release_notes` | Release notes list |
| `get_release_note` | Single release note |
| `save_release_note` | Create/update release notes |
| `list_diffs` | Linear diff PRs (filter by `owner`, `repo`) |
| `get_diff` | Lookup by review URL, GitHub PR URL, slug, UUID |
| `get_diff_threads` | Review threads on a diff |

### Meta

| Tool | Purpose |
|---|---|
| `search_documentation` | Search Linear product docs |

### Notable MCP gaps (vs GitHub MCP)

| Capability | GitHub | Linear MCP |
|---|---|---|
| Bulk sub-issue listing | `get_sub_issues` on parent | `list_issues` with `parentId` ✅ |
| Dependabot alerts | `gh api` REST ✅ | ❌ Not available |
| Issue search across repo | `search_issues` ✅ | `list_issues` + `query` (title/description only) |
| Org custom fields | `issue_fields` on write ✅ | Use `priority`, `estimate`, labels |
| Project board Status via separate entity | GraphQL `updateProjectV2ItemFieldValue` | `save_issue` → `state` directly ✅ |
| Code / PR / file ops | Full `user-github` suite | Only diff/release tools; no file read |
| Resolve GitHub `#N` from Linear | ❌ (use Linear) | `get_issue` → `attachments[]` ✅ |
| Post comment visible on GitHub issue | `add_issue_comment` ✅ | `save_comment` **only if** replying in GitHub-synced thread (see [Comment sync policy](#comment-sync-policy-linear--github)) |

---

## Current state (legacy — to be retired)

The sections below describe **today's GitHub-based skills**, which this migration **replaces**. After cutover, these are deprecated:

- GitHub Project **#5** (PipeWatch Roadmap) — **archive**
- `.cursor/skills/orchestrator/github-board.md` — replace with `linear-board.md`
- `.cursor/skills/github-intake/` — replace with `linear-intake/`
- `.cursor/skills/github-triage/` — replace with `linear-triage/`
- Rule `12-github-project-board.mdc` — replace with `12-linear-board.mdc`
- `docs/internal/github-roadmap-issue-map.json` — **retire** (legacy bulk GitHub intake script; no Linear replacement)

### Legacy board model (GitHub — do not use after migration)

- **GitHub Issues** in `mdg-labs/pipewatch` — numeric IDs `#4`–`#119+`
- **GitHub Project #5** (PipeWatch Roadmap) — **Status** field is the agent source of truth
- **Two status systems:** GitHub issue `open`/`closed` vs project **Status** (Backlog → Ready → In Progress → In Review → Done → Closed)
- Status mutations require **GraphQL** with hardcoded project/field/option IDs ([`.cursor/skills/orchestrator/github-board.md`](../../.cursor/skills/orchestrator/github-board.md))

### Legacy skills (GitHub — replace, do not extend)

| Skill / doc | Replacement |
|---|---|
| [`orchestrator/SKILL.md`](../../.cursor/skills/orchestrator/SKILL.md) | Update to Linear MCP; task IDs = `PW-N` |
| [`orchestrator/github-board.md`](../../.cursor/skills/orchestrator/github-board.md) | **`linear-board.md`** |
| [`orchestrator/prompt-templates.md`](../../.cursor/skills/orchestrator/prompt-templates.md) | LINEAR SYNC blocks; no GraphQL |
| [`github-intake/SKILL.md`](../../.cursor/skills/github-intake/SKILL.md) | **`linear-intake/SKILL.md`** |
| [`github-triage/SKILL.md`](../../.cursor/skills/github-triage/SKILL.md) | **`linear-triage/SKILL.md`** |
| [`dependabot-triage/SKILL.md`](../../.cursor/skills/dependabot-triage/SKILL.md) | Alert fetch via `gh`; Bug filed in **Linear** |
| [`security-audit/report-to-issues.md`](../../.cursor/skills/security-audit/report-to-issues.md) | Hand off to **linear-intake** |
| Rules: `02-orchestrator`, `07-issue-commit-linking`, `12-github-project-board` | Linear board; **`07` unchanged** (`fixes #N` in git) |

### Commit linking (post-migration — GitHub `#N` in git, Linear `PW-N` everywhere else)

**Two identifiers, one workflow:**

| Context | ID | Example |
|---|---|---|
| Operator prompts, orchestrator, intake, triage, status, comments | Linear | `PW-216` |
| Git commit subject & body | GitHub | `[#41]`, `fixes #41`, `refs #8` |
| Verifier commit audit | GitHub | `git log --grep='fixes #41'` |

Commits **keep the existing convention** — no `fixes PW-N` in git:

```
feat(api)[#41][#8]: add OAuth callback

fixes #41
refs #8
```

**Before the task commit**, the execution agent resolves GitHub numbers from Linear (see [PW → GitHub resolution](#pw--github-number-resolution-for-commits)):

- Leaf `PW-216` → `#41`
- Epic parent `PW-215` → `#8` (for `[#8]` in subject / `refs #8` in body)

Orchestrator prompts and batch plans cite **`PW-N` only**. GitHub `#N` appears in execution prompts only inside the **COMMIT LINK** block (resolved once at task start).

**Forbidden:** `#N` in operator invocations (`orchestrate #41`), orchestrator batch plan tables, or Slack summaries. **`fixes PW-N` in commit bodies.**

---

## Operator & agent invocation (post-migration)

All skill entry points use **Linear identifiers**:

| Intent | Say this | Not this |
|---|---|---|
| Run orchestrator on a leaf | `orchestrate PW-216` | `orchestrate #41` |
| Run orchestrator on an epic | `orchestrate PW-5` | `orchestrate #5` |
| Implement one task | `implement PW-216` | `implement #41` |
| Triage | `triage PW-12` | `triage #12` |
| Intake new work | `intake …` (creates `PW-*`) | `create GitHub issues` |
| Batch plan table | `\| PW-216 \|` | `\| #41 \|` |
| Task commit message | `[#41]` / `fixes #41` (resolved from `PW-216`) | `[PW-216]` / `fixes PW-216` |
| Slack / session summary | `PW-216` + Linear URL | `#41` as primary task ref |

Orchestrator **GitHub mode** becomes **Linear mode** (default when user names `PW-N` or a Linear URL). Chat mode (no issue key) unchanged.

---

## Live Linear workspace state (verified 2026-06-29)

**Source of truth for all task IDs going forward.**

| Entity | Value |
|---|---|
| Workspace | `linear.app/mdg-labs` |
| Team | **PipeWatch** (`key: PW`, id `8efd71ec-7e20-4b5e-a5bf-9ab66fced0e3`) |
| Project | **PipeWatch Roadmap** (`41adac83-1a88-47af-a433-18fcc4e2466e`) — **trashed** |
| Issue prefix | `PW-` (e.g. `PW-215`, `PW-221`) |
| Sample epic | `PW-215` — marketing Astro migration; 6 child issues via `parentId` |
| GitHub link | Bidirectional sync attachment → `#N` on `mdg-labs/pipewatch` (used for **commits only**) |
| Labels | Mirrored: `domain:*`, `type:epic`, `type:task`, `effort:XS`–`XL`, `regression`, `Migrated` |

### Issue statuses (PipeWatch team)

These are the **only** statuses agents set or read. No GitHub project Status field.

| Status | Linear `type` | Agent use |
|---|---|---|
| Backlog | `backlog` | Unrefined |
| Ready | `unstarted` | Intake / triage stop state |
| In Progress | `started` | Execution first action |
| In Review | `started` | Execution handoff |
| Done | `completed` | Verifier PASS |
| Closed | `completed` | Release / operator |
| Canceled | `canceled` | Declined work |
| Duplicate | `duplicate` | Duplicate of another `PW-*` |

---

## Comment sync policy (Linear → GitHub mirror)

**Policy:** All agent workflow goes through **Linear**. Comments that should appear on the mirrored GitHub issue use the **synced thread** on the Linear issue — a background visibility mirror, not a second workflow path.

Agents never call `user-github` for issue or comment operations.

### How it works

When a Linear issue is linked to a GitHub issue (attachment / Linear↔GitHub integration), Linear creates a **synced comment thread** on the Linear issue. The root comment reads:

> *This comment thread is synced to a corresponding GitHub issue. All replies are displayed in both locations.*

**Replies** to that root sync to GitHub bidirectionally. Verified on `PW-222` ↔ `#244` (2026-06-29):

| Method | Syncs to GitHub? |
|---|---|
| `save_comment` — new top-level thread (`issueId` only) | **No** — Linear only |
| `save_comment` — reply with `parentId` = synced thread root | **Yes** — appears on linked `#N` |
| GitHub comment on `#N` | **Yes** — appears as reply in synced thread on Linear |

### Required agent workflow

Before posting verifier PASS/FAIL, orchestrator handoff, or any other agent comment:

1. **`list_comments`** on the Linear issue (`issueId: "PW-N"`).
2. Find the synced thread root — `author: null`, body mentions *synced to a corresponding GitHub issue* (or match known root from issue map cache).
3. **`save_comment`** with `parentId` set to that root's `id` (not a new top-level comment).

```json
{
  "server": "plugin-linear-linear",
  "toolName": "save_comment",
  "arguments": {
    "issueId": "PW-222",
    "parentId": "<synced-thread-root-id>",
    "body": "**Verified** `abc1234`\n\nAC met:\n- …"
  }
}
```

### Migration requirements

- **Every migrated issue** must have a GitHub issue attachment **and** the synced thread present before agents comment. If the thread is missing, create/link via Linear↔GitHub integration in the UI — do not fall back to `add_issue_comment`.
- Synced thread root: resolve at comment time via `list_comments` (author `null`, body mentions GitHub sync) — **do not maintain a static map** (drift risk).
- **Forbidden for agents:** top-level `save_comment` for operational comments; `user-github` `add_issue_comment` for verifier/orchestrator output (breaks single-path Linear workflow).

### Skills affected

| Skill | Change |
|---|---|
| orchestrator / verifier | PASS/FAIL comments → synced-thread reply |
| github-triage → linear-triage | Body updates stay on `save_issue`; discussion comments → synced thread |
| dependabot-triage | Alert summary comment → synced thread after Bug created in Linear |

**Exception:** Triage **findings** stay in issue **description** (`save_issue`), not comments — same as today. Synced thread is for operational chatter (verify results, orchestrator notes), not structured triage bodies.

---

## PW → GitHub number resolution (for commits)

Bidirectional sync links each `PW-*` to a GitHub issue on `mdg-labs/pipewatch`. Agents **never** call GitHub issue APIs to look this up — use **`get_issue` only** (Linear is the single source of truth; no duplicate JSON map).

### `get_issue` at commit time (only method)

```json
{
  "server": "plugin-linear-linear",
  "toolName": "get_issue",
  "arguments": { "id": "PW-222" }
}
```

From the response, read the GitHub number from **`attachments`**:

```json
"attachments": [{
  "title": "#244 Test issue",
  "url": "https://github.com/mdg-labs/pipewatch/issues/244"
}]
```

→ commit with `[#244]`, `fixes #244`.

Parse from `attachments[].url` (path segment after `/issues/`) or `attachments[].title` (leading `#N`).

### Parent epic (for `refs #P`)

When task is epic child `PW-216` with `parentId: "PW-215"`, resolve **both**:

1. `get_issue("PW-216")` → leaf `#N`
2. `get_issue("PW-215")` → parent `#P` for subject `[#N][#P]` and body `refs #P`

### Requirements

- Every task issue **must** have a sync attachment before execution commits. If missing → **block commit**; fix Linear↔GitHub link first.
- New issues from **linear-intake** rely on sync to create the mirrored GitHub issue automatically — verify attachment exists before marking Ready for orchestration.
- **`07-issue-commit-linking.mdc` stays as-is** — no switch to `fixes PW-N`.

### Example (verified `PW-222` ↔ `#244`)

| Linear | GitHub | Commit subject fragment |
|---|---|---|
| `PW-222` | `#244` | `feat(repo)[#244]: …` + body `fixes #244` |

---

## Skill-by-skill translation assessment

### 1. Orchestrator → `linear-orchestrator` ✅ Feasible (major simplification)

| GitHub pattern | Linear equivalent |
|---|---|
| MCP `issue_read` | `get_issue` with `includeRelations: true` |
| Epic children via `get_sub_issues` | `list_issues` with `parentId: "PW-<epic>"` |
| Dependency check (board Status Done) | `get_issue` → read `status`; or `includeRelations` for `blockedBy` |
| STATUS FIRST GraphQL block | `save_issue` `{ id: "PW-N", state: "In Progress" }` — **no project item lookup** |
| Verifier → Done | `save_issue` `{ state: "Done" }` |
| Verifier FAIL → Ready | `save_issue` `{ state: "Ready" }` |
| PASS/FAIL comments | `list_comments` → synced thread root → `save_comment` with `parentId` |
| Session-end Slack summary | Linear URLs and `PW-N` in tables |
| Commit-linkage audit | Resolve `PW-N` → `#N`; then `git log --grep='fixes #N'` on `staging` |

**Improvements over GitHub:**

- Status is a **first-class issue field** — eliminates rule `12-github-project-board` (no project item ID, no membership checks).
- `blockedBy` on `save_issue` replaces optional GraphQL `addBlockedBy` (currently not wired on GitHub roadmap).
- `readonly: false` verifiers can call MCP directly — no Shell/`gh api graphql` required for status.

**Changes required:**

- Replace `github-board.md` → **`linear-board.md`**; delete GitHub board references from orchestrator skill.
- Replace GITHUB SYNC → **LINEAR SYNC** in `prompt-templates.md`.
- Task IDs in prompts, plans, Slack: **`PW-N` only**.
- Execution prompts include **COMMIT LINK** block with `#N` from orchestrator's `get_issue` call (STATUS FIRST step).
- **`07-issue-commit-linking.mdc` unchanged** — `[#N]` + `fixes #N` in git.
- **No `linear-roadmap-issue-map.json`** — avoids a second source of truth that drifts from Linear sync.

### 2. GitHub intake → `linear-intake` ✅ Direct replacement

| Step | Linear tool |
|---|---|
| Duplicate search | `list_issues` + `query` |
| Create epic | `save_issue` + labels `type:epic` |
| Create child | `save_issue` + `parentId` |
| Set dependencies | `save_issue` + `blockedBy: ["PW-238"]` |
| Priority / Effort | `priority: 1–4` + `estimate` and/or `effort:*` labels |
| Assignee | `assignee: "me"` |
| Milestone | `milestone` on issue or project milestone via `save_milestone` |
| Stop at Ready | `save_issue` + `state: "Ready"` |

**Epic pattern difference:** Linear uses **`parentId`** (one parent per issue), not GitHub's separate sub-issue graph. Functionally equivalent for PipeWatch's Feature → Task hierarchy.

**Type field:** GitHub org issue types (Task/Bug/Feature) become **labels** (`type:task`, `type:bug`, `type:epic`) — already present in migrated Linear data.

### 3. GitHub triage → `linear-triage` ✅ Feasible

| Rule | Linear approach |
|---|---|
| Update body, not comments | `save_issue` + `description` (same as GitHub `issue_write` update) |
| Preserve `## Report` | Unchanged in description markdown |
| Status → Ready | `save_issue` + `state: "Ready"` |
| Never In Progress/Done | Same guardrails |
| Regression → new issue | `save_issue` create + `regression` label + link via `relatedTo` or description |

**Triage preference for comments vs body:** GitHub triage explicitly forbids findings as comments. Linear triage should **keep updating description** for parity.

### 4. Dependabot triage — Linear for issues, GitHub for alerts only

| Step | Tool |
|---|---|
| Fetch alert | `gh api` (GitHub REST) — **only** Dependabot read |
| Search duplicates | `list_issues` + `query` on Linear |
| Create Bug | `save_issue` in Linear (`type:bug` label) |
| Link to alert | `links: [{ url, title }]` on Linear issue |
| Summary comment | Synced-thread `save_comment` on the new `PW-*` |

**No manual GitHub Issue create/update by agents.** Sync creates the mirrored `#N`; intake verifies attachment before Ready.

### 5. Security audit → issues handoff ✅ Feasible via linear-intake

Same field mapping as linear-intake; hand off to **linear-intake**. Public disclosure guard still applies.

### 6. Rules & repo artefacts

| Artefact | Action |
|---|---|
| `.cursor/rules/02-orchestrator.mdc` | Linear board; `PW-N` task refs; retire GitHub project |
| `.cursor/rules/07-issue-commit-linking.mdc` | **Keep** `[#N]` + `fixes #N` — resolve `#N` from Linear |
| `.cursor/rules/12-github-project-board.mdc` | **Replace** with `12-linear-board.mdc` |
| `docs/internal/github-roadmap-issue-map.json` | **Retire** (legacy; no Linear replacement) |
| `orchestrator/github-board.md` | **Replace** with `linear-board.md` |
| `github-intake/`, `github-triage/` skills | **Replace** with `linear-intake/`, `linear-triage/` |

### Forbidden after cutover (agents)

- `user-github` `issue_read`, `issue_write`, `search_issues`, `add_issue_comment` for PipeWatch tasks
- `gh api graphql` for project Status (`updateProjectV2ItemFieldValue`)
- Referencing `#N` in **operator invocations**, orchestrator batch plans, or Slack summaries (use `PW-N`)
- `fixes PW-N` or `[PW-N]` in commit messages
- Creating new work on GitHub Project #5

---

## GitHub Projects vs Linear — capability matrix (post-migration)

| Concern | GitHub Projects v2 | Linear | Winner for agents |
|---|---|---|---|
| Set task status | GraphQL + project item ID | `save_issue(state)` | **Linear** |
| Parent / child | `sub_issue_write` (database IDs) | `parentId` on save | **Linear** |
| Blocking deps | GraphQL `addBlockedBy` (node IDs) | `blockedBy` on save | **Linear** |
| Custom workflow states | Single-select field options | Team statuses via name | Tie |
| Priority | Org custom field | Native 0–4 | Tie |
| Effort | Org field + t-shirt labels | `estimate` + labels | Tie |
| Milestones | GitHub milestones (#1 MVP) | Project milestones | Tie (different model) |
| Issue types | Task / Bug / Feature (org) | Labels | GitHub (cleaner) |
| Commit auto-link | `fixes #N` in git ( `#N` from Linear sync) | Linked via integration | **GitHub** (git) + **Linear** (lookup) |
| Dependabot | Native | None | **GitHub** |
| PR / code review | GitHub MCP | Linear Diffs (optional) | **GitHub** (today) |
| Agent MCP ergonomics | MCP + GraphQL shell | Pure MCP for board ops | **Linear** |
| Agent comments → GitHub issue | `add_issue_comment` | `save_comment` in synced thread only | **Linear** (if policy enforced) |
| Public issue visibility | Public repo issues | Workspace-scoped | Depends on policy |

---

## Proposed Linear board constants (draft)

Replace github-board.md constants with:

```text
MCP server: plugin-linear-linear
Workspace: mdg-labs
Team: PipeWatch (key: PW)
Team ID: 8efd71ec-7e20-4b5e-a5bf-9ab66fced0e3
Project: PipeWatch Roadmap (restore from trash or recreate)
Project ID: 41adac83-1a88-47af-a433-18fcc4e2466e
Issue URL: https://linear.app/mdg-labs/issue/PW-<N>/<slug>
Task ID format: PW-<N>   (team key PW + issue number)
```

**No static issue map.** Resolve GitHub `#N` and synced-thread root at runtime via Linear MCP (`get_issue`, `list_comments`). The old `github-roadmap-issue-map.json` was a bulk artifact for one-time GitHub issue creation from the roadmap markdown — it must not be duplicated for Linear.

### Status workflow (MCP)

```text
# Execution — first action
save_issue { id: "PW-<leaf>", state: "In Progress" }
save_issue { id: "PW-<parent>", state: "In Progress" }  # if epic child

# Execution — last action
save_issue { id: "PW-<leaf>", state: "In Review" }

# Verifier PASS
list_comments { issueId: "PW-<leaf>" }  → resolve synced-thread root id
save_comment { issueId: "PW-<leaf>", parentId: "<synced-root>", body: "<PASS template>" }
save_issue { id: "PW-<leaf>", state: "Done" }

# Verifier FAIL
save_comment { issueId: "PW-<leaf>", parentId: "<synced-root>", body: "<FAIL template>" }
save_issue { id: "PW-<leaf>", state: "Ready" }
```

No hardcoded status UUIDs required — Linear MCP accepts status **names**.

### Required fields (linear-intake — every new issue)

| Field | Linear implementation |
|---|---|
| Type | Label: `type:task` / `type:bug` / `type:epic` |
| Domain | Label: `domain:frontend` / `domain:backend` / … |
| Priority | `priority: 1–4` (1=Urgent … 4=Low) |
| Effort | `estimate` points and/or `effort:XS`–`XL` label |
| Assignee | `assignee: "me"` |
| Milestone | Project milestone name or MVP label convention |

---

## Commit linking (GitHub `#N` in git — resolve from Linear)

**Decision:** Split ID model.

| Where | ID |
|---|---|
| All task workflow (prompts, board, comments) | `PW-N` |
| Git commits & `git log` audit | `#N` |

```
feat(api)[#41][#8]: add OAuth callback

fixes #41
refs #8
```

| Part | Rule |
|---|---|
| Operator / orchestrator | Cite **`PW-N` only** |
| Commit subject | `[#<leaf>]` (+ `[#<parent>]` when subtask) — numbers from Linear sync |
| Commit body | `fixes #<leaf>`; subtasks always `refs #<parent>` |
| Epic close | `fixes #<parent>` on final child only (`CLOSE_PARENTS`) |
| Verifier audit | Map `PW-N` → `#N`, then `git log staging --grep='fixes #N'` |
| Resolution | `get_issue(PW-N)` → `attachments[].url` (see [PW → GitHub resolution](#pw--github-number-resolution-for-commits)) |

**Forbidden:** `fixes PW-N` or `[PW-N]` in commits; `#N` in operator prompts or batch plans.

### Retired strategies (do not use)

| Strategy | Why retired |
|---|---|
| `fixes PW-N` in git | GitHub auto-close requires `fixes #N` |
| `#N` in orchestrator batch plans | Operator works in Linear keys only |
| Manual `issue_read` to resolve `#N` | Use Linear `get_issue` attachments instead |

---

## Migration phases

### Phase 0 — Prep ✅ done (roadmap era)

Historical — MVP roadmap build and Linear backfill are complete. Ongoing work is **iterations and bugs** filed directly in Linear (`PW-*`).

1. ~~Restore **PipeWatch Roadmap** project~~ — use Linear team/project as configured.
2. ~~Complete Linear backfill for all roadmap work~~ — **done**.
3. Verify bidirectional sync on new issues before first commit (`get_issue` → GitHub attachment).
4. **`07-issue-commit-linking.mdc` unchanged** — resolve `#N` from `get_issue` before commit.

### Phase 1 — Skills cutover (intake & triage) ✅ done (2026-06-29)

1. ~~Ship **`linear-intake/`** and **`linear-triage/`**; remove GitHub skills~~
2. **All new work** filed in Linear only (`PW-*`).
3. Operator references **`PW-N`** exclusively.

Also shipped: `linear-board.md`, `12-linear-board.mdc`, updated `02-orchestrator.mdc`, `dependabot-triage`, `security-audit` handoff.

### Phase 2 — Orchestrator cutover ✅ done (2026-06-29)

1. ~~Ship **`linear-board.md`**; rewrite orchestrator skill for Linear MCP~~
2. ~~Replace STATUS FIRST GraphQL with `save_issue(state)`~~ — see `prompt-templates.md`
3. Batch plans, Slack summaries, and session memory use **`PW-N`** and Linear URLs.

### Phase 3 — Decommission GitHub task tracking (partial)

1. ~~Replace rule `12-github-project-board.mdc` → **`12-linear-board.mdc`**~~ ✅
2. Archive GitHub Project **#5** (operator).
3. Retire `github-roadmap-issue-map.json` and `scripts/github-intake-from-roadmap.py` when no longer needed (operator).
4. ~~Remove GitHub issue skills/rules from `.cursor/`~~ ✅

---

## Risks & blockers

| Risk | Severity | Mitigation |
|---|---|---|
| Missing GitHub attachment on new `PW-*` | High | Block commit until sync link exists (`get_issue` → attachments) |
| Commit uses `PW-N` instead of `#N` | High | COMMIT LINK block in execution prompt; verifier Layer 3c3 |
| Dependabot alert fetch | Low | `gh api` read-only; bugs filed as `PW-*` |
| `list_issues` search weaker than GitHub | Low | Use label + parentId filters |
| Linear issues not public like GitHub | Low | Confirm disclosure policy for security findings |
| Agent auth | Low | Linear MCP already connected |
| Missing synced thread on linked issue | High | Block comment post until thread exists; use `list_comments` |
| Top-level Linear comment by mistake | Medium | Enforce `parentId` in LINEAR SYNC blocks; verifier Layer 3 check |

---

## Verdict by skill

| Skill | Translate to Linear? | Effort | Notes |
|---|---|---|---|
| orchestrator | **Yes** | Medium | Largest rewrite; net simplification (no GraphQL) |
| github-board → linear-board | **Yes** | Low | Constants + STATUS FIRST templates |
| github-intake → linear-intake | **Replace** | Medium | GitHub skill retired |
| github-triage → linear-triage | **Replace** | Low | GitHub skill retired |
| dependabot-triage | **Yes** (Linear bugs) | Low | Alert fetch via `gh` only |
| security-audit handoff | **Yes** | Trivial | Point at linear-intake |
| prompt-templates | **Yes** | Medium | LINEAR SYNC blocks |
| workspace-notes / Slack notify | **Yes** | Trivial | URL/id swap |

---

## Appendix: example MCP calls

### Set In Progress (replaces GraphQL STATUS FIRST)

```json
{
  "server": "plugin-linear-linear",
  "toolName": "save_issue",
  "arguments": {
    "id": "PW-216",
    "state": "In Progress"
  }
}
```

### List epic children

```json
{
  "server": "plugin-linear-linear",
  "toolName": "list_issues",
  "arguments": {
    "parentId": "PW-215",
    "limit": 50
  }
}
```

### Create task with dependency

```json
{
  "server": "plugin-linear-linear",
  "toolName": "save_issue",
  "arguments": {
    "title": "Scaffold Astro marketing app",
    "team": "PipeWatch",
    "project": "PipeWatch Roadmap",
    "parentId": "PW-215",
    "state": "Ready",
    "priority": 3,
    "labels": ["domain:infrastructure", "type:task", "effort:M"],
    "assignee": "me",
    "blockedBy": []
  }
}
```

### Verifier PASS comment (synced thread — mirrors to GitHub)

```json
{
  "server": "plugin-linear-linear",
  "toolName": "list_comments",
  "arguments": { "issueId": "PW-216" }
}
```

Resolve synced-thread root id from response, then:

```json
{
  "server": "plugin-linear-linear",
  "toolName": "save_comment",
  "arguments": {
    "issueId": "PW-216",
    "parentId": "<synced-thread-root-id>",
    "body": "**Verified** `abc1234`\n\nAC met:\n- Criterion 1\n- Criterion 2"
  }
}
```

**Do not** omit `parentId` — top-level comments stay Linear-only and will not appear on the linked GitHub issue.

### Resolve GitHub number for commit (before `git commit`)

```json
{
  "server": "plugin-linear-linear",
  "toolName": "get_issue",
  "arguments": { "id": "PW-222" }
}
```

From `attachments[0].url` → `#244` → commit with `[#244]` / `fixes #244`.

---

## References

- Linear MCP descriptors: `.cursor/projects/.../mcps/plugin-linear-linear/tools/*.json`
- **To be replaced:** [`.cursor/skills/orchestrator/github-board.md`](../../.cursor/skills/orchestrator/github-board.md) → `linear-board.md`
- [`.cursor/skills/orchestrator/SKILL.md`](../../.cursor/skills/orchestrator/SKILL.md) — rewrite for Linear
- **To be replaced:** `github-intake/`, `github-triage/` → `linear-intake/`, `linear-triage/`
