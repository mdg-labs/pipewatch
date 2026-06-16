---
name: github-triage
description: Investigate a PipeWatch bug or task read-only, then update the GitHub issue body with code findings — or create a new Bug when no issue exists. Preserves original reporter text under ## Report. Use when the user asks to triage, investigate, or diagnose a GitHub issue (e.g. #12), or reports a bug without an existing key.
---

# GitHub triage (PipeWatch)

Read-only investigation, then **update issue body/title** — or **create a Bug** when no key exists.

Board: [orchestrator/github-board.md](../orchestrator/github-board.md) (project **#5**). Layout: [description-template.md](description-template.md). Summaries: [summary-patterns.md](summary-patterns.md). Docs: [doc-index.md](../orchestrator/doc-index.md).

## When to use

| User intent | Action |
|---|---|
| "Triage #12", issue URL | **Update mode** |
| Bug report, no key | **Create mode** — new Bug |
| "Don't change code" | Read-only |
| "Fix it" after triage | Separate implementation pass |
| "Don't update GitHub" | Skip issue writes |

## Hard rules

1. **No implementation** during triage — read-only.
2. **Update `body` via MCP `issue_write`** — never post findings as comments.
3. **Preserve `## Report`** verbatim at top.
4. **Summaries** per [summary-patterns.md](summary-patterns.md).
5. **After triage:** Status → **Ready** unless user opted out or issue is In Progress/In Review/Done.
6. **Never** set In Progress, In Review, or Done.
7. **Regression:** if same bug was board **Done/Closed**, create new Bug with `regression` label — do not re-open old issue.

## Create mode (new Bug)

```text
MCP issue_write (method: create):
- owner: mdg-labs, repo: pipewatch
- type: Bug
- labels: ["domain:backend"]  # or appropriate domain
- assignees: [<get_me>]
- milestone: <number>
- issue_fields: Priority + Effort
```

Regression: add `regression` label + `## Regression` section referencing originating `#N`.

Then Status → **Ready** (GraphQL, project #5).

## Update mode workflow

```
- [ ] Fetch issue via MCP issue_read
- [ ] Lock ## Report text
- [ ] Investigate (read-only)
- [ ] Regression check via search_issues + board Status
- [ ] Compose body from description-template.md
- [ ] MCP issue_write (update) body + title if needed
- [ ] Status → Ready if currently Backlog
- [ ] Summarize in chat
```

**Guard:** Never move **Done/Closed** issues back to Ready — create Regression Bug instead.

## Forbidden

- Findings as issue comments
- In Progress / In Review / Done during triage
- `gh issue create`
- Re-opening Done/Closed issues
