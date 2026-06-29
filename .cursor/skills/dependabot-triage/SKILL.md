---
name: dependabot-triage
description: Fetch a Dependabot security alert from the pipewatch repo via gh CLI, search Linear for a duplicate Bug covering the same package or CVE, and create a new Bug in Linear if no open duplicate exists. Use when the user references a Dependabot alert number, CVE/GHSA ID, GitHub security URL, or asks to triage a dependency vulnerability.
---

# Dependabot triage (PipeWatch)

Fetch alert → search Linear duplicates → create Linear Bug if needed.

Board: [orchestrator/linear-board.md](../orchestrator/linear-board.md). Policy: `.cursor/rules/08-dependabot-alerts.mdc`.

## Hard rules

1. **Never** `PATCH state=dismissed` on alerts.
2. **No code changes** during triage.
3. Do not set In Progress / Done — new bugs stay at default until orchestrator picks them up.
4. Use `save_issue` on Linear — **not** `user-github` issue tools.

## Board constants

```text
MCP server: plugin-linear-linear
Team: PipeWatch
Project: PipeWatch Roadmap
Alert fetch: gh api repos/mdg-labs/pipewatch/dependabot/alerts/<N>
```

## Workflow

```
- [ ] Phase 1: Fetch alert (gh api)
- [ ] Phase 2: Search Linear duplicates
- [ ] Phase 3: Create Bug in Linear if needed
- [ ] Phase 4: Summarize
```

### Phase 1 — Fetch alert

```bash
gh api repos/mdg-labs/pipewatch/dependabot/alerts/<N>
```

Record: alert_number, package_name, manifest_path, vulnerable_range, patched_version, severity, cve_id, ghsa_id, summary.

### Phase 2 — Duplicate search

```text
list_issues: { team: "PipeWatch", query: "<package_name>" }
list_issues: { team: "PipeWatch", query: "<cve_id>" }
```

- Open duplicate (Linear status not Done) → report existing `PW-N`; do not create.
- Done duplicate → create anyway (possible regression).
- No duplicate → Phase 3.

### Phase 3 — Create Bug in Linear

Domain from `manifest_path`:
- `apps/web` → `domain:frontend`
- `apps/api` / `apps/worker` → `domain:backend`
- root tooling → `domain:infrastructure`

```json
{
  "title": "dep(<package>): vulnerable to <cve_id> — bump to <patched>",
  "team": "PipeWatch",
  "project": "PipeWatch Roadmap",
  "labels": ["type:bug", "domain:backend", "dependabot", "effort:M"],
  "priority": 1,
  "assignee": "me",
  "links": [{ "url": "https://github.com/mdg-labs/pipewatch/security/dependabot/<N>", "title": "Dependabot alert" }]
}
```

Verify GitHub sync attachment on new issue. Summary comment → synced thread if needed.

**Description:** include alert details and resolution path (bump + full CI gate). Commit will use `fix(deps)[#N]` after resolving `#N` from `get_issue`.

### Phase 4 — Summarize

Alert details, duplicate status, new `PW-N`, suggested next step: `implement PW-N`.

## Forbidden

- Dismissing alerts
- Setting In Progress / Done during triage
- `user-github` issue create/update
- Posting findings as comments instead of description
