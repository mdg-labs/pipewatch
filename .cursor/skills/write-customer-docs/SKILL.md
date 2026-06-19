---
name: write-customer-docs
description: >-
  Author or refresh PipeWatch customer and operator documentation in the
  pipewatch-docs repo as MDX for Documentation.AI. Use when the user invokes
  /write-customer-docs, asks to write customer docs, operator guides, public
  documentation, MDX pages, documentation.json navigation, or refresh customer
  docs content. Explicit invocation only — not auto-loaded.
disable-model-invocation: true
---

# Write customer docs (PipeWatch)

Author **customer and operator** documentation published via [Documentation.AI](https://documentation.ai). Source lives in the **[`mdg-labs/pipewatch-docs`](https://github.com/mdg-labs/pipewatch-docs)** repository (repo root).

**Authoring guide:** `pipewatch-docs/README.md` · **MDX format rule:** `pipewatch-docs/.cursor/rules/documentation.ai.mdc` · **Spec:** `pipewatch/docs/internal/PipeWatch_MVP_PRD.md` · **Pages:** `pipewatch/docs/internal/PipeWatch_Page_Inventory.md`

## Workspace layout (two repos)

| Workspace folder | GitHub repo | Role |
|---|---|---|
| `pipewatch/` | [`mdg-labs/pipewatch`](https://github.com/mdg-labs/pipewatch) | App monorepo — routes, UI, engineering spec (`pipewatch/docs/internal/`), agent skills (`pipewatch/.cursor/`) |
| `pipewatch-docs/` | [`mdg-labs/pipewatch-docs`](https://github.com/mdg-labs/pipewatch-docs) | Customer/operator MDX — **edit here for public docs** |

**Open:** [`pipewatch/pipewatch.code-workspace`](../../../pipewatch.code-workspace). Sibling checkout at `../pipewatch-docs`.

**Git:** commit MDX and `documentation.json` in **`pipewatch-docs`** only. Discovery reads from **`pipewatch`**.

## Hard rules

1. **English only** for customer MDX.
2. **Never guess product behaviour** — discover from PRD, Page Inventory, and app code before drafting.
3. **Never edit `pipewatch/docs/internal/`** as part of customer doc work — cite PRD sections; do not copy engineering docs verbatim.
4. **Never commit secrets** — use placeholders in examples.
5. **Defer MDX format details** to `pipewatch-docs/.cursor/rules/documentation.ai.mdc`.
6. **Both steps to add a page:** create `.mdx` under `pipewatch-docs/` **and** register `path` in `documentation.json`.
7. **Internal links** use root-absolute paths without `/docs` prefix — e.g. `/getting-started/ce-quickstart`.

## Reference files

| File | Use when |
|---|---|
| [discovery-sources.md](discovery-sources.md) | Before any draft |
| [information-architecture.md](information-architecture.md) | Planning nav groups and page inventory |
| [page-templates.md](page-templates.md) | Choosing page type and skeletons |
| [screenshot-placeholders.md](screenshot-placeholders.md) | Visual placeholders before CDN upload |
| [tone-and-vocabulary.md](tone-and-vocabulary.md) | Voice and PRD terminology |
| [examples.md](examples.md) | Good vs bad excerpts |

## Workflow

1. **Scope** — breadth (full corpus · one group · single page), mode (greenfield vs maintenance), audience
2. **Discovery** — follow [discovery-sources.md](discovery-sources.md)
3. **IA proposal** — page inventory table (bulk work only); see [information-architecture.md](information-architecture.md)
4. **Draft MDX** — templates + tone; Documentation.AI components per `documentation.ai.mdc`
5. **Wire navigation** — update `documentation.json`
6. **Summarise** — paths changed, nav updates, open spec gaps

## Out of scope

- Engineering docs in `pipewatch/docs/internal/`
- Legal, changelog, marketing pages (stay on `pipewatch.app`)
- OpenAPI authoring in `pipewatch-docs` (Scalar at `api.pipewatch.app/api/docs` for MVP)

## Quick commands

```bash
# List customer MDX
find pipewatch-docs -name '*.mdx' | sort

# Search PRD
rg 'workspace' pipewatch/docs/internal/PipeWatch_MVP_PRD.md

git -C pipewatch status
git -C pipewatch-docs status
```
