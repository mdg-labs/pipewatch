# Tone and vocabulary

Customer docs voice and mandatory terminology for PipeWatch public MDX.

## Voice

- **Task-first** — lead with what the reader will accomplish
- **Second person** — "you", active voice, present tense for current product behaviour
- **Operator vs end user** — CE install guides address operators; Cloud quickstart addresses workspace owners and members
- **No implementation jargon** — describe outcomes, not internal job names or schema details unless writing reference pages

## Product vocabulary (PRD — mandatory)

| Use in customer docs | Never use (API/schema copy) |
|---|---|
| workspace | organization, org, tenant |
| integration | github_app (as type name) |
| pipeline run | workflow_run |
| pipeline job | workflow_job |
| repository | repo (as API resource name) |
| member | user (for workspace membership) |
| PipeWatch CE / PipeWatch Cloud | inconsistent edition naming |

**UI copy exception:** may say **workflow** when referring to GitHub Actions terminology (Page Inventory, PRD §4.5).

## Edition naming

- **PipeWatch Cloud** — managed at `cloud.pipewatch.app`
- **PipeWatch CE** — self-hosted Community Edition via Docker Compose
- Do not say "open-core edition" or "community" without "CE" in headings

## Secrets and examples

- Never commit real `JWT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, webhook secrets, or API keys
- Use placeholders: `your-webhook-secret`, `openssl rand -hex 32`
- PEM keys: show structure, not real key material

## Link conventions

- Internal: `[Run lifecycle](/concepts/run-lifecycle)` — root-absolute, no `/docs` prefix
- External API: `https://api.pipewatch.app/api/docs` (Scalar)
- GitHub App install: `https://github.com/apps/pipewatch/installations/new` (Cloud) or operator's app slug (CE)

## Audience framing

| Audience | Typical pages | Open with |
|---|---|---|
| End user | Cloud quickstart, concepts | "After this guide, you will…" |
| Workspace admin | Members, integrations settings | Prerequisites + permissions needed |
| CE operator | CE quickstart, GitHub App setup, CE reference | Infrastructure prerequisites first |
