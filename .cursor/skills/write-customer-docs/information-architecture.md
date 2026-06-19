# Information architecture

PipeWatch public docs use Documentation.AI's **Dimensions → Views → Content** model. Source: `pipewatch-docs/documentation.json`.

## Product dimensions

PipeWatch uses a **single product** with grouped guides — Cloud and CE content share one nav tree. Sections are grouped by topic, not by edition tab.

| Group | Audience | Typical content |
|---|---|---|
| Getting Started | End user + operator | Cloud quickstart, CE quickstart |
| GitHub App Setup | Operator (CE) + Cloud installers | App registration, permissions, webhooks |
| Concepts | All readers | Workspaces, integrations, run lifecycle, editions |
| Self-Hosted (CE) Reference | CE operators | Env vars, Compose, upgrades, backups |
| API Reference | Integrators | External link to Scalar at `api.pipewatch.app/api/docs` |

**Prefer separate pages** when Cloud and CE behaviour diverges materially (e.g. billing, webhook URL, GitHub App ownership). Cross-link between editions in prose when helpful.

Published URL: `getting-started/cloud-quickstart.mdx` → `/getting-started/cloud-quickstart`

Default route: `initialRoute` → `getting-started/cloud-quickstart`

## Tabs and groups

Current structure:

```text
navigation.products[]
  └── product: "PipeWatch"
        └── tabs[]
              └── tab: "Guides"
                    └── groups[]
                          └── pages[]  OR  href (external API docs)
```

### Guides groups (current)

| Group | Paths | Audience |
|---|---|---|
| Getting Started | `getting-started/cloud-quickstart`, `getting-started/ce-quickstart` | End user + operator |
| GitHub App Setup | `github-app-setup/*` (4 pages) | Operator |
| Concepts | `concepts/*` (5 pages) | All readers |
| Self-Hosted (CE) Reference | `ce-reference/*` (4 pages) | CE operator |
| API Reference | `href` → Scalar | Integrators |

REST API reference stays on Scalar for MVP — not OpenAPI files in this repo.

## Page inventory (shipped)

| path | title | type | audience | prerequisites |
|------|-------|------|----------|---------------|
| getting-started/cloud-quickstart | Cloud quickstart | how-to | end-user | — |
| getting-started/ce-quickstart | CE quickstart | how-to | operator | — |
| github-app-setup/creating-the-app | Creating the GitHub App | how-to | operator | — |
| github-app-setup/permissions-and-events | Permissions and events | reference | operator | creating-the-app |
| github-app-setup/webhook-url | Webhook URL | how-to | operator | creating-the-app |
| github-app-setup/cloudflare-tunnel | Cloudflare Tunnel guide | operator-runbook | operator | webhook-url |
| concepts/workspaces | Workspaces | concept | end-user | — |
| concepts/integrations | Integrations | concept | end-user | workspaces |
| concepts/run-lifecycle | Run lifecycle | concept | end-user | integrations |
| concepts/webhook-vs-polling | Webhook vs polling mode | concept | operator | integrations |
| concepts/editions | Editions | concept | end-user | — |
| ce-reference/environment-variables | Environment variables | reference | operator | ce-quickstart |
| ce-reference/docker-compose | Docker Compose config | reference | operator | ce-quickstart |
| ce-reference/upgrading | Upgrading | operator-runbook | operator | ce-quickstart |
| ce-reference/backups | Backups | operator-runbook | operator | ce-quickstart |

### Column rules

- **path** — lowercase-with-hyphens, matches `.mdx` path under repo root, no `.mdx` suffix
- **type** — `how-to` · `concept` · `operator-runbook` · `troubleshooting` · `reference`
- **audience** — `end-user` · `workspace-admin` · `operator`
- **prerequisites** — comma-separated paths readers should complete first (or `—`)

## Path naming conventions

| Rule | Good | Bad |
|---|---|---|
| Lowercase, hyphenated | `cloud-quickstart` | `CloudQuickstart` |
| Group prefix in path | `getting-started/cloud-quickstart` | `cloud-quickstart` at repo root |
| No `/docs` prefix in links | `/concepts/workspaces` | `/docs/concepts/workspaces` |

## `documentation.json` wiring checklist

For each new page:

1. Create `{path}.mdx` under `pipewatch-docs/` with `title` and `description` frontmatter.
2. Add to the correct chain:

```json
{
  "title": "CE quickstart",
  "path": "getting-started/ce-quickstart",
  "icon": "server"
}
```

3. Push to `pipewatch-docs` `main` — Documentation.AI validates on build.

## Cross-linking strategy

- **Internal:** root-absolute links — `[CE quickstart](/getting-started/ce-quickstart)`
- **External:** Scalar API docs, `cloud.pipewatch.app`, GitHub — full URLs in MDX or `href` in `documentation.json`
- **Marketing:** `pipewatch.app` for pricing/changelog/legal — not duplicated in customer docs unless needed

## English-only scope

All customer MDX in `pipewatch-docs` is **English only**. Do not plan German MDX variants in this skill.
