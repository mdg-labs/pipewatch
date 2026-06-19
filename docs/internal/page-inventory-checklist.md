# PipeWatch Page Inventory — Regression Checklist

**Source:** [`PipeWatch_Page_Inventory.md`](./PipeWatch_Page_Inventory.md) summary table (A1–A7, B0–B22)  
**Automation:** [`e2e/specs/page-inventory.spec.ts`](../../e2e/specs/page-inventory.spec.ts)  
**Release gate:** copy the checklist section into release PRs (see [`.github/PULL_REQUEST_TEMPLATE/release.md`](../.github/PULL_REQUEST_TEMPLATE/release.md))

Run automated coverage:

```bash
# App pages + edition/role gating (local ephemeral stack)
pnpm test:e2e specs/page-inventory.spec.ts

# CE edition project
PIPEWATCH_EDITION=ce pnpm test:e2e --project=ce specs/page-inventory.spec.ts

# Marketing pages (requires deployed or local marketing URL)
E2E_MARKETING_URL=https://staging.pipewatch.app pnpm test:e2e specs/page-inventory.spec.ts
```

---

## Coverage matrix

| # | Route | Surface | Automated | Manual / integration |
|---|---|---|---|---|
| A1 | `/` | Marketing | E2E when `E2E_MARKETING_URL` set | Staging smoke |
| A2 | `/pricing` | Marketing | E2E when `E2E_MARKETING_URL` set | Plan CTA + billing toggle |
| A3 | `/docs` → `docs.pipewatch.app` | Marketing redirect | E2E redirect smoke | External docs on Documentation.AI |
| A4 | `/changelog` | Marketing | E2E when `E2E_MARKETING_URL` set | Anchor links per version |
| A5 | `/waitlist` | Marketing (cloud) | E2E skip if 404 | Submit + confirm flow |
| A6 | `/privacy`, `/terms` | Marketing | E2E route smoke | Legal TOC anchors |
| A7 | `/waitlist/confirm`, `/unsubscribe` | Marketing (cloud) | E2E confirm route smoke | Token success/error states |
| B0 | `/setup` | App (CE) | Edition gating in E2E | Fresh-install bootstrap (empty DB) |
| B1 | `/sign-in` | App | E2E + staging smoke | `?next=` redirect |
| B2 | `/onboarding` | App | Onboarding spec + step 1 smoke | Full wizard (#116) |
| B3 | `/workspaces/:slug/` | App | Dashboard spec + inventory smoke | SSE live indicator |
| B4 | `/workspaces/:slug/repos/:repoId` | App | Inventory smoke | Filters + pagination |
| B5 | `/workspaces/:slug/repos/:repoId/settings` | App | Inventory smoke + member read-only | Save sync/retention |
| B6 | `…/runs/:runId` | App | Dashboard spec + inventory smoke | Job graph + SSE |
| B7 | `/workspaces/:slug/insights` | App | Inventory smoke | Charts + time range |
| B8 | `/workspaces/:slug/settings` | App | Inventory smoke + member read-only | Slug change warning |
| B9 | `…/settings/members` | App | Inventory smoke + member read-only | Invite modal |
| B10 | `…/settings/integrations` | App | Inventory smoke + member read-only | Add integration |
| B11 | `…/settings/api-keys` | App | Inventory smoke + member read-only | One-time key reveal |
| B12 | `…/settings/billing` | App | E2E owner load + member blocked | Stripe checkout/portal |
| B13 | `/account` | App | Inventory smoke | Logout everywhere |
| B14 | `/api/docs` | API | E2E HTTP smoke | Scalar try-it panel |
| B15 | `GET /auth/github` | System | `auth/github.integration.test.ts` | OAuth redirect |
| B16 | `GET /auth/github/callback` | System | `auth/github.integration.test.ts` | Token issue + redirect |
| B17 | `GET /onboarding/github-callback` | System | `onboarding/github-callback.integration.test.ts` | Install persistence |
| B18 | `/invite/:token` | App | `workspaces/invites.integration.test.ts` | Accept landing UI |
| B19 | `POST /webhooks/github` | System | `webhooks/github.integration.test.ts` | HMAC validation |
| B20 | `POST /webhooks/stripe` | System (cloud) | `webhooks/stripe.integration.test.ts` | Subscription sync |
| B21 | `POST /webhooks/postmark` | System (cloud) | `webhooks/postmark.integration.test.ts` | Bounce handling |
| B22 | `GET …/repos/:repoId/stream` | System | `repos/stream.integration.test.ts`, `sse-token.integration.test.ts` | Live events |

---

## UI smoke — marketing (A1–A7)

- [ ] **A1 Homepage** — hero, feature blocks, editions section, footer; no 5xx
- [ ] **A2 Pricing** — plan cards, comparison table, FAQ; no 5xx
- [ ] **A3 Docs** — `/docs` redirects to `docs.pipewatch.app`; nav links to external docs; no 5xx
- [ ] **A4 Changelog** — timeline entries render; no 5xx
- [ ] **A5 Waitlist** — form or redirect when `LAUNCH_MODE=live`; no 5xx
- [ ] **A6 Legal** — privacy + terms prose; no 5xx
- [ ] **A7 Confirm/unsubscribe** — invalid token shows error card; no 5xx

## UI smoke — app (B0–B14)

- [ ] **B0 CE bootstrap** — `/setup` on fresh CE install; cloud returns 404
- [ ] **B1 Sign-in** — GitHub CTA, marketing link; no 5xx
- [ ] **B2 Onboarding** — steps 1–4 reachable; no 5xx
- [ ] **B3 Dashboard** — health summary + repo cards/table; no 5xx
- [ ] **B4 Repo detail** — header, workflow tabs, run table; no 5xx
- [ ] **B5 Repo settings** — sync mode, retention, danger zone; no 5xx
- [ ] **B6 Run detail** — job graph, steps, GitHub link; no 5xx
- [ ] **B7 Insights** — summary cards + charts/tables or empty state; no 5xx
- [ ] **B8 Workspace general** — name/slug, plan summary (cloud); no 5xx
- [ ] **B9 Members** — active + pending tables; no 5xx
- [ ] **B10 Integrations** — GitHub cards, add integration; no 5xx
- [ ] **B11 API keys** — table + create modal; no 5xx
- [ ] **B12 Billing** — plan card, usage, invoices (cloud owner); no 5xx
- [ ] **B13 Account** — profile, workspaces list; no 5xx
- [ ] **B14 API docs** — Scalar UI at `{API_URL}/api/docs`; no 5xx

## System routes — API integration (B15–B22)

- [ ] **B15–B16 OAuth** — `apps/api/src/routes/auth/github.integration.test.ts`
- [ ] **B17 GitHub install callback** — `apps/api/src/routes/onboarding/github-callback.integration.test.ts`
- [ ] **B18 Invite accept** — `apps/api/src/routes/workspaces/invites.integration.test.ts`
- [ ] **B19 GitHub webhook** — `apps/api/src/routes/webhooks/github.integration.test.ts`
- [ ] **B20 Stripe webhook (cloud)** — `apps/api/src/routes/webhooks/stripe.integration.test.ts`
- [ ] **B21 Postmark webhook (cloud)** — `apps/api/src/routes/webhooks/postmark.integration.test.ts`
- [ ] **B22 SSE stream** — `apps/api/src/routes/sse-token.integration.test.ts`, `apps/api/src/routes/workspaces/repos/stream.integration.test.ts`

Run: `pnpm test:integration`

---

## Role gating

| Page | Expected member behaviour | Verified by |
|---|---|---|
| B5 Repo settings | Read-only banner; save/disable/delete disabled | E2E `page-inventory.spec.ts` |
| B8 General settings | Read-only banner; save disabled | E2E |
| B9 Members | Read-only banner; no Invite button | E2E |
| B10 Integrations | Read-only banner; no Add integration | E2E |
| B11 API keys | Read-only banner; no Create API key | E2E |
| B12 Billing | Owner only — insufficient permissions for member/admin | E2E |

Manual spot-check (optional): sign in as workspace **admin** on B12 — should also see insufficient permissions.

---

## Edition gating (PRD §26)

| Concern | CE | Cloud | Verified by |
|---|---|---|---|
| Workspace switcher | Hidden | Visible | E2E edition project |
| Billing nav (B12) | Hidden / 404 | Visible | E2E |
| `/setup` (B0) | Active when no users | 404 | E2E + manual fresh install |
| Multi-workspace create | Hidden | `/workspaces/new` | Manual |

Run CE project: `PIPEWATCH_EDITION=ce pnpm test:e2e --project=ce specs/page-inventory.spec.ts`

---

## Mockup parity spot-check (13 `.dc.html` screens)

Design mockups: `docs/internal/design-mockup/V1/`

| Mockup | Page | Spot-check notes |
|---|---|---|
| Homepage.dc.html | A1 | Hero + dashboard preview placement; CTA hierarchy |
| Sign In.dc.html | B1 | Centered card, single GitHub CTA, legal footer links |
| CE Bootstrap.dc.html | B0 | CE badge, fresh-install status, OAuth primary action |
| Onboarding.dc.html | B2 | Step indicator, wizard card width, back/next placement |
| Dashboard.dc.html | B3 | Health bar, repo cards, filter/sort controls |
| Repo Detail.dc.html | B4 | Header badges, workflow tabs, run table density |
| Repo Settings.dc.html | B5 | Section grouping, danger zone separation |
| Run Detail.dc.html | B6 | Job graph lanes, failed step emphasis |
| Insights.dc.html | B7 | Summary stat row, chart grid, slowest/failing tables |
| Settings Members.dc.html | B9 | Active + pending tables, invite CTA top-right |
| API Keys.dc.html | B11 | Prefix column, one-time reveal modal pattern |
| Billing.dc.html | B12 | Plan card, usage meters, invoice table |
| Account Settings.dc.html | B13 | Profile + connected accounts sections |

- [ ] All 13 mockups reviewed against staging (or local) — layout, hierarchy, and primary actions match within MVP scope

---

*Checklist version: page inventory v0.3 — June 2026*
