# Triage description template (PipeWatch)

Use for MCP `issue_write` body. Keep `## Report` first — verbatim.

**Title:** separate `title` param per [summary-patterns.md](summary-patterns.md).

```markdown
## Report

{Original description — unchanged}

## Regression

{Regression Bugs only: "Escaped defect from #N (board was Done/Closed)."}

## Classification

{Frontend / Backend / Infrastructure. PRD ref e.g. prd §4.4 for webhooks.}

## {Flow name}

{End-to-end steps — e.g. "Webhook ingest flow", "JWT refresh flow", "SSE subscribe flow"}

## Failure modes / gates

| Gate | Effect |
|---|---|
| {condition} | {what breaks} |

## Suspects (ranked)

1. **`path/file.ts`** — {why}
2. ...

## Recommended triage

1. {concrete check}

## Key files

- `apps/api/src/...` — {role}
```

## Section guide

| Section | Required |
|---|---|
| `## Report` | **Yes** — always first |
| `## Classification` | Yes |
| `## Regression` | Regression Bugs only |
| Flow section | When applicable |
| Suspects | Yes for Bugs |
| Key files | Yes |

Re-triage: preserve `## Report`, replace sections below.
