# Intake plan template

Copy this structure when writing a plan under `plans/`. Fill every field — use `—` or `none` when not applicable.

**Filename:** `plans/YYYY-MM-DD-<short-slug>.md` (kebab-case slug, date = today).

---

```markdown
# Intake plan: <one-line summary>

**Status:** draft | approved | created
**Created:** YYYY-MM-DD
**Source:** <user request / bug report / PW-N enrich>
**Planner:** agent session

## Summary

<2–4 sentences: what we're ticketing, why, scope decision (single issue vs epic).>

## Duplicate check

| Candidate | Result |
|---|---|
| <search query or PW-N> | none / duplicate of PW-N — action: skip or link |

## Structure

| Role | Count | Rationale |
|---|---|---|
| Epic | 0 or 1 | <why or "single leaf — no epic"> |
| Children | N | <why split> |

## Implementation order

1. <plan-key-a> → <plan-key-b> → …

---

## Issues

### <plan-key> — epic | task | bug

| Field | Value |
|---|---|
| **Title** | <per summary-patterns.md, ≤80 chars> |
| **Type label** | `type:epic` \| `type:task` \| `type:bug` |
| **Domain label** | `domain:frontend` \| `domain:backend` \| `domain:infrastructure` \| `domain:operations` |
| **Extra labels** | e.g. `regression`, `effort:M` — or `none` |
| **Priority** | 1 (Urgent) \| 2 (High) \| 3 (Medium) \| 4 (Low) |
| **Effort** | `effort:XS` \| `effort:S` \| `effort:M` \| `effort:L` \| `effort:XL` |
| **Assignee** | `me` |
| **Project** | `PipeWatch Roadmap` |
| **Parent** | `<plan-key of epic>` \| none |
| **Blocked by** | `<plan-key>` \| none |
| **Blocks** | `<plan-key>` \| none |
| **Related to** | `PW-N` \| none |
| **Initial state** | `Ready` (always after create + GitHub sync) |

**PRD refs:** prd §N, …

**Description:**

<paste full markdown from templates.md — Bug / Backend subtask / Frontend subtask / Epic parent>

**Created as:** `PW-___` _(fill after Phase 2 — leave blank in draft)_

---

### <plan-key> — task

(repeat per issue)

---

## Post-create checklist

- [ ] All issues created via `save_issue`
- [ ] `parentId` set on children (use created `PW-N` keys, not plan-keys)
- [ ] `blockedBy` wired with real `PW-N` keys
- [ ] Epic description updated with sub-issues table (`PW-*` keys)
- [ ] GitHub sync attachment present on each issue (`get_issue` → `attachments`)
- [ ] All issues set to `Ready`
- [ ] Plan status → `created`; fill **Created as** fields above

## Handoff (after create — do not implement)

Suggest: `implement PW-N` or `orchestrate PW-<epic>` — operator decides when to start.
```

## Plan-key convention

Use stable local keys (`epic`, `api-hmac`, `web-badge`) in the plan. Replace with `PW-N` only in **Post-create** and when setting `parentId` / `blockedBy` during Phase 2.

## Single-issue plans

Omit the epic section; one `###` block with `Parent: none` is enough.

## Enrich plans

For existing `PW-N`, use one issue block with:

| Field | Value |
|---|---|
| **Target** | `PW-N` (update — not create) |
| **Title change** | keep \| new title |
| **Fields to update** | description, labels, priority, … |

Skip **Post-create** GitHub sync for issues that already exist; still set `Ready` if currently `Backlog`.
