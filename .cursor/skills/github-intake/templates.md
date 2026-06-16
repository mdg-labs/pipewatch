# Issue description templates (PipeWatch)

Summaries (titles): [summary-patterns.md](../github-triage/summary-patterns.md).

**Milestone required on every create.** Fetch milestones first ([github-intake § Milestones](../github-intake/SKILL.md)).

## Feature (epic) parent

```markdown
## Feature: {Feature name}

**Background:** {Why we're building this}. PRD refs: prd §{N}.

---

### Sub-issues

| Issue | Domain | Description |
|---|---|---|
| #XX | Backend | {one line} |
| #YY | Frontend | {one line} |

---

### Goal

{What users can do when done.}

---

### Product rules (epic-level)

- {Rule from PRD, e.g. prd §4.4: webhook HMAC always enforced}
- {Edition rule, e.g. prd §26: cloud-only billing}

---

### Suggested implementation order

1. **#XX** → **#YY**
2. **#ZZ**

---

See child issues for AC, files, and tests.
```

## Backend subtask

```markdown
## {Title}

**Parent feature:** #XX {title}
**Depends on:** #YY | none
**Spec refs:** prd §{N}

---

### Schema / data model

- `{table.column}` — {purpose}

---

### Endpoints / services

**{METHOD} {path}** — {behaviour}

---

### Acceptance criteria

- [ ] {testable criterion}
- [ ] {testable criterion}

---

### Files (expected)

- `apps/api/src/...`
- `packages/db/schema/...`

---

### Tests

- Unit: `...
- Integration: `...
```

## Frontend subtask

```markdown
## {Title}

**Parent feature:** #XX
**Depends on:** #YY API issue | none
**Page ref:** pages {B-series section}

---

### UI behaviour

- {layout, states, edition differences CE vs Cloud}

---

### Acceptance criteria

- [ ] {criterion}

---

### Files (expected)

- `apps/web/src/...`

---

### Tests

- Unit / e2e: `...
```

## Bug template

```markdown
## Report

{Original reporter text}

---

### Expected

{Correct behaviour per PRD}

### Actual

{What happens}

### Acceptance criteria

- [ ] {fix verification}
```
