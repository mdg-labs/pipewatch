# Handoff: audit report → GitHub issues

Convert a completed audit report into **Ready** issues on project **#5** by handing structured findings to the **`github-intake`** skill. This file defines the mapping so intake can run immediately without re-deriving fields.

`security-audit` does **not** create issues itself. It prepares the payload; `github-intake` does the creation (it requires user approval and stops at Ready — `.cursor/skills/github-intake/SKILL.md`).

## When to hand off

After presenting the report, offer this if the user says "file these", "create issues", "ticket the findings", or "send to the board". Otherwise stop at the report.

## Disclosure guard (read first)

`mdg-labs/pipewatch` issues may be publicly visible.

- **Never** put working exploits, PoC payloads, secret values, or copy-paste attack steps in an issue body. Describe **impact + location + fix direction** only (this also satisfies `github-intake`'s "no secrets" rule).
- For 🔴 Critical / 🟠 High findings, **ask the user** whether to file publicly now or handle disclosure privately first. Default: ask before filing exploitable detail.

## Structure decision

| Situation | Intake shape |
|---|---|
| 1 finding | Single **Bug** (or **Task** for pure hardening) |
| 2+ findings | **Feature (epic)** "Security audit remediation — <date>" + child Bugs/Tasks |
| ⚪ Info-only hardening backlog | Group under one Feature; children are **Tasks** |

## Field mapping (the six required by github-intake)

For each finding, supply the values below; `github-intake` resolves type/field IDs from [orchestrator/github-board.md](../orchestrator/github-board.md).

| Audit attribute | Intake field | Rule |
|---|---|---|
| Vulnerability / defect | **type** = `Bug` | Findings that are a flaw in existing behaviour |
| Hardening / new control | **type** = `Task` (or `Feature` if it spans 2+ tasks) | `recommendations.md` items, missing defense-in-depth |
| Severity → **Priority** | `issue_fields` | 🔴→`Urgent` · 🟠→`High` · 🟡→`Medium` · 🔵/⚪→`Low` |
| Domain of the code | **domain label** | backend: auth/webhooks/billing/api/worker · infrastructure: DB/CE Docker/CI/Fly/CF/Redis · frontend: `apps/web`/dashboard/SSE client · operations: marketing/docs/runbooks |
| Fix size estimate → **Effort** | `issue_fields` | `Low` (XS/S) · `Medium` (M) · `High` (L/XL) |
| — | **assignee** | `get_me` |
| — | **milestone** | default `1` (MVP) unless user says otherwise |

Severity must also appear **in the issue body** (the org Priority field alone loses the security nuance). Re-filed previously-fixed issues get the `regression` label alongside the domain label.

## Per-finding body template

Give `github-intake` this block per finding so the created issue is self-contained:

```markdown
## Summary
<one-line: the weakness and where>

## Severity
🔴 Critical — Priority: Urgent  <!-- mirror the audit rating -->

## Location
`apps/api/src/...:LINE`

## Impact
<what an attacker gains — no PoC, no payloads>

## Acceptance criteria
- [ ] <control exists / test added proving the fix>
- [ ] <regression test for the invariant where applicable>

## References
PRD §x · `.cursor/rules/03-security-baseline.mdc` · <OWASP category>
```

## Handoff procedure

```
- [ ] Confirm scope: which findings to file (default: all 🔴🟠🟡; ask about 🔵/⚪)
- [ ] Apply the disclosure guard for 🔴/🟠
- [ ] Build the structure (single Bug vs Feature epic + children)
- [ ] For each: fill the six fields + body template above
- [ ] Invoke github-intake with this payload (it proposes structure, waits for approval, creates, stops at Ready)
```

Then report back the issue numbers and suggested remediation order, mirroring `github-intake`'s own "After creation" handoff (`"implement #N"` / `"orchestrate #epic"`).
