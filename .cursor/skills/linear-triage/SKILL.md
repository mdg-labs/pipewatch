---
name: linear-triage
description: Investigate a PipeWatch bug or task read-only, then update the Linear issue description — or create a new Bug when no issue exists. Preserves original reporter text under ## Report. Use when the user asks to triage, investigate, or diagnose a Linear issue (e.g. PW-12), or reports a bug without an existing key.
---

# Linear triage (PipeWatch)

Read-only investigation, then **update issue description/title** — or **create a Bug** when no key exists.

Board: [orchestrator/linear-board.md](../orchestrator/linear-board.md). Layout: [description-template.md](description-template.md). Summaries: [summary-patterns.md](summary-patterns.md). Docs: [doc-index.md](../orchestrator/doc-index.md).

## When to use

| User intent | Action |
|---|---|
| "Triage PW-12", Linear URL | **Update mode** |
| Bug report, no key | **Create mode** — new Bug |
| "Don't change code" | Read-only |
| "Fix it" after triage | Separate implementation pass |
| "Don't update Linear" | Skip issue writes |

## Hard rules

1. **No implementation** during triage — read-only.
2. **Update `description` via `save_issue`** — never post findings as comments.
3. **Preserve `## Report`** verbatim at top.
4. **Summaries** per [summary-patterns.md](summary-patterns.md).
5. **After triage:** Status → **Ready** unless user opted out or issue is In Progress/In Review/Done.
6. **Never** set In Progress, In Review, or Done.
7. **Regression:** if same bug was **Done**, create new Bug with `regression` label — do not re-open old issue.

## Create mode (new Bug)

```json
{
  "server": "plugin-linear-linear",
  "toolName": "save_issue",
  "arguments": {
    "title": "…",
    "team": "PipeWatch",
    "project": "PipeWatch Roadmap",
    "labels": ["type:bug", "domain:backend", "effort:M"],
    "priority": 2,
    "assignee": "me",
    "description": "…"
  }
}
```

Regression: add `regression` label + `## Regression` section referencing originating `PW-N`.

Then verify GitHub sync attachment → `save_issue` → `state: "Ready"`.

## Update mode workflow

```
- [ ] get_issue PW-N
- [ ] Lock ## Report text
- [ ] Investigate (read-only)
- [ ] Regression check via list_issues + status
- [ ] Compose body from description-template.md
- [ ] save_issue — update description + title if needed
- [ ] state → Ready if currently Backlog
- [ ] Summarize in chat
```

**Guard:** Never move **Done** issues back to Ready — create Regression Bug instead.

## Forbidden

- Findings as issue comments (description only)
- In Progress / In Review / Done during triage
- `user-github` issue tools
- Re-opening Done issues
