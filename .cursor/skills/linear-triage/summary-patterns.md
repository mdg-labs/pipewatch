# Issue summary patterns (PipeWatch)

Single source of truth for **issue titles**. Both `linear-triage` and `linear-intake` must follow this.

## Pattern table

| Issue type | Pattern | Examples |
|---|---|---|
| **Bug** | `{Area}: {observed defect}` | `Webhooks: invalid signature returns 500 instead of 401` |
| **Task** | `{Verb} {target}` | `Add HMAC verification for GitHub webhook endpoint` |
| **Epic** | `{Feature name}` | `GitHub App installation and backfill` |

## Area prefixes

`Workspaces` · `Integrations` · `Repositories` · `Pipelines` · `Runs` · `Webhooks` · `Auth` · `Billing` · `SSE` · `Insights` · `Onboarding` · `Dashboard` · `API` · `Marketing` · `CE` · `CI` · `Infra` · `Worker` · `Deps`

Cross-check **domain label** — prefix and domain should align.

## Length

≤ **80 characters** where possible.

## Rewrite vs keep

| Situation | Action |
|---|---|
| Vague placeholder | Rewrite per pattern |
| Wrong area or typo | Rewrite |
| Already correct | Keep |
| User specified title | Use user wording |
