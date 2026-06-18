## Release summary

<!-- One paragraph: what ships in this release and why. -->

## Pre-merge verification

- [ ] Full CI gate passed on `staging` (`pnpm ci:gate`)
- [ ] Staging deploy smoke passed (if applicable)
- [ ] No open **blocker** issues for this release

## Page inventory regression

Complete before promoting `staging` → `main`. Full matrix, manual steps, and integration references:

**[`docs/internal/page-inventory-checklist.md`](../../docs/internal/page-inventory-checklist.md)**

### Automated checks

```bash
pnpm test:e2e specs/page-inventory.spec.ts
PIPEWATCH_EDITION=ce pnpm test:e2e --project=ce specs/page-inventory.spec.ts
E2E_MARKETING_URL=https://staging.pipewatch.app pnpm test:e2e specs/page-inventory.spec.ts
pnpm test:integration
```

### Release checklist (attach completed copy)

#### Marketing UI smoke (A1–A7)

- [ ] A1 Homepage — no 5xx
- [ ] A2 Pricing — no 5xx
- [ ] A3 Docs — no 5xx
- [ ] A4 Changelog — no 5xx
- [ ] A5 Waitlist — no 5xx (or live redirect)
- [ ] A6 Privacy + Terms — no 5xx
- [ ] A7 Confirm/unsubscribe routes — no 5xx

#### App UI smoke (B0–B14)

- [ ] B0 CE bootstrap / cloud 404
- [ ] B1 Sign-in — no 5xx
- [ ] B2 Onboarding — no 5xx
- [ ] B3 Dashboard — no 5xx
- [ ] B4 Repo detail — no 5xx
- [ ] B5 Repo settings — no 5xx
- [ ] B6 Run detail — no 5xx
- [ ] B7 Insights — no 5xx
- [ ] B8 Workspace general — no 5xx
- [ ] B9 Members — no 5xx
- [ ] B10 Integrations — no 5xx
- [ ] B11 API keys — no 5xx
- [ ] B12 Billing (cloud owner) — no 5xx
- [ ] B13 Account — no 5xx
- [ ] B14 API docs — no 5xx

#### System routes (B15–B22)

- [ ] B15–B16 OAuth — integration tests green
- [ ] B17 GitHub install callback — integration tests green
- [ ] B18 Invite accept — integration tests green
- [ ] B19 GitHub webhook — integration tests green
- [ ] B20 Stripe webhook (cloud) — integration tests green
- [ ] B21 Postmark webhook (cloud) — integration tests green
- [ ] B22 SSE stream + token — integration tests green

#### Role gating

- [ ] Member read-only on B5, B8–B11
- [ ] Owner-only on B12

#### Edition gating

- [ ] CE hides billing + workspace switcher; `/setup` CE-only
- [ ] Cloud hides `/setup`; billing visible

#### Mockup parity (13 `.dc.html`)

- [ ] Mockup spot-check completed (see checklist doc)

## Rollback plan

<!-- How to revert if production deploy fails. -->

## Notes

<!-- Optional: migrations, secrets, operator steps. -->
