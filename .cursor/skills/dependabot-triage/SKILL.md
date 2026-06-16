---
name: dependabot-triage
description: Fetch a Dependabot security alert from the pipewatch repo via gh CLI, search GitHub Issues for a duplicate Bug covering the same package or CVE, and create a new Bug if no open duplicate exists. Use when the user references a Dependabot alert number, CVE/GHSA ID, GitHub security URL, or asks to triage a dependency vulnerability.
---

# Dependabot triage (PipeWatch)

Fetch alert → search duplicates → create Bug if needed.

Board: [orchestrator/github-board.md](../orchestrator/github-board.md). Policy: `.cursor/rules/08-dependabot-alerts.mdc`.

## Hard rules

1. **Never** `PATCH state=dismissed` on alerts.
2. **No code changes** during triage.
3. Do not set In Progress / Done — new bugs stay at default until intake/orchestrator picks them up.
4. Use MCP `issue_write` for create/update.

## Board constants

```text
Owner: mdg-labs
Repo: pipewatch
Project: 5
```

## Workflow

```
- [ ] Phase 1: Fetch alert
- [ ] Phase 2: Search duplicates
- [ ] Phase 3: Create Bug if needed
- [ ] Phase 4: Summarize
```

### Phase 1 — Fetch alert

```bash
gh api repos/mdg-labs/pipewatch/dependabot/alerts/<N>
```

By CVE/GHSA: filter open alerts with `jq`.

Record: alert_number, package_name, manifest_path, vulnerable_range, patched_version, severity, cve_id, ghsa_id, summary.

### Phase 2 — Duplicate search

```text
MCP search_issues: { query: "<package_name>", owner: "mdg-labs", repo: "pipewatch" }
MCP search_issues: { query: "<cve_id>", owner: "mdg-labs", repo: "pipewatch" }
```

- Open duplicate (not Done) → report existing `#N`; do not create.
- Done duplicate → create anyway (possible regression).
- No duplicate → Phase 3.

### Phase 3 — Create Bug

Domain from `manifest_path`:
- `apps/web` → `domain:frontend`
- `apps/api` / `apps/worker` → `domain:backend`
- root tooling → `domain:infrastructure`

```text
MCP issue_write (method: create):
- title: "dep(<package>): vulnerable to <cve_id> — bump to <patched>"
- type: Bug
- labels: ["domain:backend", "security", "dependabot"]  # adjust domain
- issue_fields: Priority Urgent, Effort Medium
- milestone: <earliest open>
```

**Description:**

```markdown
## Report

Dependabot alert #<N>: <summary>

## Alert details

- **Package:** `<name>` — **Manifest:** `<path>`
- **Vulnerable:** `<range>` — **Patched:** `>= <version>`
- **Severity:** <severity> — **CVE:** <cve> — **GHSA:** <ghsa>
- **URL:** https://github.com/mdg-labs/pipewatch/security/dependabot/<N>

## Resolution path

Bump to `>= <patched>`. Run full CI gate. Commit to `staging` with `fix(deps)[#N]: ...`.
See rule `08-dependabot-alerts.mdc`.
```

### Phase 4 — Summarize

Alert details, duplicate status, new issue link, suggested next step.

## Forbidden

- Dismissing alerts
- Setting In Progress / Done
- `gh issue create`
- Posting findings as comments instead of body
