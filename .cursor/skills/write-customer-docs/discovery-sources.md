# Discovery sources

Read these **in order** before drafting or refreshing customer docs. Never guess product behaviour — if a source is silent and the feature is not observable in the app, stop and ask.

**Workspace:** discovery reads from `pipewatch/` (monorepo); published MDX lives in `pipewatch-docs/`. Open both via `pipewatch/pipewatch.code-workspace`.

## Ordered read list

| Order | Source | Path | What to extract |
|---|---|---|---|
| 1 | **Page inventory** | `pipewatch/docs/internal/PipeWatch_Page_Inventory.md` | Screen names, layout, edition differences, empty/loading states |
| 2 | **Product spec (PRD)** | `pipewatch/docs/internal/PipeWatch_MVP_PRD.md` | Authoritative behaviour, API, data model, edition flags, limits |
| 3 | **App routes** | `pipewatch/apps/web/src/app/` | URL paths, onboarding, settings, dashboard |
| 4 | **UI components** | `pipewatch/apps/web/src/components/` | Visible labels, CTAs, settings sections |
| 5 | **Edition flags** | `pipewatch/packages/config/edition.ts` | CE vs Cloud feature gates |
| 6 | **Existing public MDX** | `pipewatch-docs/**/*.mdx` | Current published content |
| 7 | **Site navigation** | `pipewatch-docs/documentation.json` | Groups, registered paths, external links |

### Supplementary sources (as needed)

| Source | Path | When |
|---|---|---|
| Operator runbooks | `pipewatch/docs/internal/GitHub_App_Setup_Runbook.md` | GitHub App setup accuracy |
| Env reference | `pipewatch/.env.example`, PRD §23 | CE environment variable docs |
| Public README | `pipewatch-docs/README.md` | Repo layout, path conventions, image workflow |

**Do not** copy engineering docs from `pipewatch/docs/internal/` into customer MDX — cite and translate for operators/end users.

## Greenfield discovery (0 MDX for an area)

1. **Map routes to doc topics** — walk `pipewatch/apps/web/src/app/` and Page Inventory B-series pages.
2. **Read PRD sections** cited in the Linear task description (auth §7, onboarding §13, CE §25, editions §26).
3. **Note edition gates** — from `packages/config/edition.ts` (`flags.BILLING_ENABLED`, `flags.WORKSPACE_SWITCHER`, etc.).
4. **Check `pipewatch-docs/documentation.json`** — confirm group and empty slots for new `path` entries.
5. **Build behaviour notes table** before IA proposal:

```text
| Feature | Route / screen | PRD § | Edition gate | Customer doc path |
```

## Maintenance discovery (existing MDX)

1. **Inventory current pages** — list `pipewatch-docs/**/*.mdx` and cross-check every `path` in `documentation.json`.
2. **Diff app behaviour** — compare page claims against PRD and current UI.
3. **Link audit** — verify root-absolute internal links (`/getting-started/...`, `/concepts/...`); no `/docs/` prefix.
4. **Produce a change list** — stale · missing · incorrect · new — before editing.

## Route → doc area map (starter)

| App area | Typical doc topics | PRD / Page Inventory |
|---|---|---|
| `/onboarding` | Cloud quickstart, GitHub App install | `prd §13`, `pages B1` |
| `/setup` | CE bootstrap | `prd §16`, `pages B0` |
| Dashboard / runs | Run lifecycle, SSE | `prd §19`, `pages B3–B5` |
| Settings → Integrations | Integrations, webhook vs polling | `pages B8` |
| Settings → Members | Workspaces, roles | `prd §5`, `pages B9` |
| Settings → Billing | Cloud plans (Cloud only) | `prd §24` |
| CE Compose / `.env` | CE reference group | `prd §25`, `prd §23` |

## Edition visibility notes

Document **what the reader sees in their edition**, not scattered `process.env` checks:

| Concern | CE | Cloud |
|---|---|---|
| Workspace switcher | Hidden (single workspace) | Visible |
| Billing settings | Hidden | Visible |
| GitHub App | Operator-created app | Managed `pipewatch` app |
| Bootstrap `/setup` | Active when user count = 0 | Redirect to sign-in |

Use `flags` from `packages/config/edition.ts` when verifying implementation — never duplicate edition logic in docs prose as ad-hoc env checks.
