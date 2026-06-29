# Issue description templates (PipeWatch)

Summaries (titles): [summary-patterns.md](../linear-triage/summary-patterns.md).

**Project required on every create:** `PipeWatch Roadmap`.

## Epic parent

```markdown
## Feature: {Feature name}

**Background:** {Why we're building this}. PRD refs: prd §{N}.

---

### Sub-issues

| Issue | Domain | Description |
|---|---|---|
| PW-XX | Backend | {one line} |
| PW-YY | Frontend | {one line} |

---

### Goal

{What users can do when done.}

---

### Product rules (epic-level)

- {Rule from PRD}

---

### Suggested implementation order

1. **PW-XX** → **PW-YY**

---

See child issues for AC, files, and tests.
```

## Backend subtask

```markdown
## {Title}

**Parent feature:** PW-XX {title}
**Depends on:** PW-YY | none
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

---

### Files (expected)

- `apps/api/src/...`

---

### Tests

- Unit: `...
- Integration: `...
```

## Frontend subtask

```markdown
## {Title}

**Parent feature:** PW-XX
**Depends on:** PW-YY API issue | none
**Page ref:** pages {B-series section}

---

### UI behaviour

- {layout, states, edition differences}

---

### Acceptance criteria

- [ ] {criterion}

---

### Files (expected)

- `apps/web/src/...`
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
