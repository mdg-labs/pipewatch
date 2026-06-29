# Handoff: audit report → Linear issues

Convert a completed audit report into **Ready** Linear issues by handing structured findings to the **`linear-intake`** skill.

`security-audit` does **not** create issues itself. It prepares the payload; `linear-intake` creates issues (requires user approval, stops at Ready — `.cursor/skills/linear-intake/SKILL.md`).

## When to hand off

After presenting the report, offer this if the user says "file these", "create issues", "ticket the findings", or "send to the board". Otherwise stop at the report.

## Disclosure guard (read first)

Linear issues may be visible to workspace members; linked GitHub issues may be public.

- **Never** put working exploits, PoC payloads, secret values, or copy-paste attack steps in an issue body.
- For 🔴 Critical / 🟠 High findings, **ask the user** whether to file publicly now or handle disclosure privately first.

## Structure decision

| Situation | Intake shape |
|---|---|
| 1 finding | Single **Bug** (or **Task** for pure hardening) |
| 2+ findings | **Epic** "Security audit remediation — <date>" + child Bugs/Tasks |
| ⚪ Info-only hardening backlog | Group under one epic; children are **Tasks** |

## Field mapping (linear-intake required fields)

For each finding, supply the values below; `linear-intake` uses [orchestrator/linear-board.md](../orchestrator/linear-board.md).

| Audit attribute | Intake field | Rule |
|---|---|---|
| Vulnerability / defect | Label `type:bug` | Flaws in existing behaviour |
| Hardening / new control | Label `type:task` (or epic if 2+ tasks) | Defense-in-depth |
| Severity → **Priority** | `priority` | 🔴→1 · 🟠→2 · 🟡→3 · 🔵/⚪→4 |
| Domain | **domain label** | backend / infrastructure / frontend / operations |
| Fix size → **Effort** | `effort:*` label | XS/S→effort:S · M→effort:M · L/XL→effort:L |
| — | **assignee** | `"me"` |
| — | **project** | PipeWatch Roadmap |

Severity must appear **in the issue body**. Re-filed bugs get `regression` label.

## Per-finding body template

Give `linear-intake` this block per finding:

```markdown
## Summary
<one-line: the weakness and where>

## Severity
🔴 Critical — Priority: Urgent

## Location
`apps/api/src/...:LINE`

## Impact
<what an attacker gains — no PoC>

## Acceptance criteria
- [ ] <control exists / test added>

## References
PRD §x · `.cursor/rules/03-security-baseline.mdc`
```

## Handoff procedure

```
- [ ] Confirm scope: which findings to file
- [ ] Apply disclosure guard for 🔴/🟠
- [ ] Build structure (single Bug vs epic + children)
- [ ] For each: fill fields + body template
- [ ] Invoke linear-intake (proposes structure, waits for approval, creates, stops at Ready)
```

Report back **`PW-N`** keys and handoff: `"implement PW-N"` / `"orchestrate PW-<epic>"`.
