# PipeWatch workspace notes

## 2026-06-18 — P135 epic #135 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON · **Base:** `94e6063`

| Issue | Status | Commit |
|---|---|---|
| #136 sync-secrets manifest + validator | Done | `ec7f842` |
| #140 CF_ACCOUNT_ID for Wrangler | Done | `5e9f935` |
| #137 Fly api/worker app provision | Done | `412cefb` |
| #138 Fly Redis preflight | Done | `6fb87e0` |
| #135 epic parent | Done | closes via #138 `fixes #135` |

**Notes:**
- Orchestrator chain: `provision-fly` → `provision-redis` → `sync-secrets` → `deploy`
- `sync-secrets-manifest.ts` + drift validator in CI
- `REDIS_URL` derived; `GH_*` storage keys; `CF_ACCOUNT_ID` wired
- Redis first-time deploy: `.github/infra/redis/fly.toml` with `--bind ::`
- 4 commits ahead of run base on `staging` (not pushed)

**Next suggested:** push `staging`; operator sync Phase Staging → GHA (GH_* keys, CF_ACCOUNT_ID); manual dispatch or push to exercise full deploy chain

## 2026-06-18 — #139 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON · **Base:** `b08e699`

| Issue | Status | Commit |
|---|---|---|
| #139 Rename GITHUB_* secrets for GHA compatibility | Done | `94e6063` |

**Notes:**
- GH_* storage keys in sync-secrets.yml; `github-secret-map.sh` maps to runtime GITHUB_* on Fly
- PRD §23 + .env examples document storage vs runtime naming
- `sync-secrets.test.sh` for mapping verification
- Comment on #136 for manifest follow-up
- No DB migrations
- Uncommitted local changes may still exist from REDIS_URL derivation (pre-#139) — check `git status`

**Next suggested:** operator rename Phase Staging `GITHUB_*` → `GH_*` and re-sync to GHA; or orchestrate #135 epic (#136–#138)

## 2026-06-18 — P22 epic #128 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON · **Base:** `e008377`

| Issue | Status | Commit(s) |
|---|---|---|
| #129 P22-01 sync-secrets Fly modes | Done | `99eea7a` |
| #130 P22-02 inline deploy-staging | Done | `b247621` |
| #131 P22-03 inline deploy-production | Done | `f4757ef` |
| #132 P22-04 orchestrator + CE rename | Done | `7accee0` |
| #133 P22-05 delete obsolete workflows | Done | `b1450fa` |
| #134 P22-06 PRD §22 + Decision #34 | Done | `4b3ea00` |
| #128 epic parent | Done | closes via #134 `fixes #128` |

**Notes:**
- Epic order: #129 → #130 → #131 → #132 → #133 → #134 (Lane S serial)
- Flat nine-file layout; only `orchestrator.yml` calls reusable workflows
- Deploy workflows inline jobs only (no nested `uses:`)
- `sync-secrets`: `stage-only` (pipeline) vs `stage-and-deploy` (manual dispatch)
- `release: published` on orchestrator; `deploy-production` workflow_call only
- Deleted per-service deploy workflows + obsolete `manual-sync-secrets.yml`
- `build-ce-image.yml` → `build-and-push-ce-image.yml`
- PRD §10/§22 + Decision #34 updated
- No new DB migrations
- `staging` 15 commits ahead of `origin/staging` (not pushed)

**Next suggested:** push `staging` to origin to exercise new orchestrator routing

## 2026-06-18 — P20 epic #120 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #121 P20-01 Composite setup + deploy scripts | Done | `f3a29e8` |
| #122 P20-02 Consolidate ci.yml + ReportPortal | Done | `378401c` |
| #123 P20-03 Orchestrator sole PR/push entry | Done | `3be8cfd` |
| #124 P20-04 Staging deploy + CF Access smoke | Done | `962ca43` |
| #125 P20-05 Production deploy + versioned CE | Done | `06f3a45` |
| #30 P0-06 Sentry releases + source maps | Done | `1b78378` |
| #126 P20-06 Extract e2e.yml workflow | Done | `eda36e2` |
| #127 P20-07 CI hygiene + PRD §22 sync | Done | `e008377` |
| #120 epic parent | Done | closes via #127 `fixes #120` |

**Notes:**
- Epic order: #121 → #122 → #123 → #124 → #125 → #30 → #126 → #127 (Lane S serial)
- orchestrator.yml sole PR/push entry; ci.yml workflow_call only; deploy-production on release published
- Phase→GHA env sync model; sync-secrets first in staging/production deploy chains
- Sentry wired into deploy-staging + deploy-production; graceful skip without secrets
- e2e.yml reusable (cloud staging smoke + CE ephemeral); advisory on PRs
- Orphaned lint/test-unit/test-integration workflows removed; actions SHA-pinned
- No new DB migrations
- `staging` 9 commits ahead of `origin/staging` (not pushed)

**Next suggested:** push `staging` to origin, or unblocked backlog items

## 2026-06-18 — P19 epic #23 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #116 P19-01 Playwright E2E suite | Done | `b693804` |
| #117 P19-02 OpenAPI completeness audit | Done | `4e6d6cc` |
| #118 P19-03 CE smoke docs | Done | `fd35b2c` |
| #119 P19-04 Page inventory regression checklist | Done | `835c97d` |
| #23 epic parent | Done | closes via #119 `fixes #23` |

**Notes:**
- Epic order: #116 → #117 → #118 → #119 (Lane S serial; #117 serialized vs #116 due to shared e2e/ hot files)
- #116: Playwright E2E (mock OAuth, onboarding, dashboard, run detail), ReportPortal agent, `pnpm test:e2e` wrapper, dev-only API mocks
- #117: Full PRD §7 OpenAPI audit, Scalar x-tagGroups, openapi.json snapshot + integration test
- #118: CE/cloud quickstart + GitHub App setup docs aligned with compose; `scripts/ce-smoke-test.sh`
- #119: page-inventory.spec.ts, checklist doc, release PR template; role/edition gating tests
- No new DB migrations
- `staging` ~42 commits ahead of `origin/staging` (not pushed)

**Next suggested:** #30 P0-06 Sentry CI (unblocked since #110 Done) or push `staging` to origin

## 2026-06-18 — P18 epic #22 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #114 P21-01 Ephemeral test deps (prereq) | Done | `6571dfd` |
| #110 P18-01 CI workflows | Done | `c022727` |
| #111 P18-02 Deploy orchestrator | Done | `f62b4ab` |
| #112 P18-03 manual-sync + version-check | Done | `02fdc24` |
| #113 P18-04 build-ce-image GHCR | Done | `f6f3713` |
| #22 epic parent | Done | closes via #113 `fixes #22` |

**Notes:**
- Epic order: #114 (prereq blocker) → #110 → #111 → #112 → #113 (Lane S serial)
- #110 blocked on #114 until prereq dispatched first
- CI: reusable lint/unit/integration; GHA Postgres+Redis services; e2e advisory on PR
- Deploy: staging push → staging; release → production; sync-secrets GHA→Fly/CF; migrate via DATABASE_URL_UNPOOLED
- CE images: reusable build-ce-image.yml (api/worker/web → GHCR)
- No new DB migrations
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P19 epic #23 or unblocked #30 (Sentry CI — was blocked on #110)

## 2026-06-18 — P16 epic #20 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #101 P16-01 Marketing layout + nav/footer | Done | `33612f9`, `b8e5a1b` (env fix) |
| #102 P16-02 Homepage (A1) | Done | `6f9e55d` |
| #103 P16-03 Pricing page (A2) | Done | `3573f8f` |
| #105 P16-05 Changelog page (A4) | Done | `80469b3` |
| #107 P16-07 Legal pages (A6) | Done | `3ecd5eb` |
| #104 P16-04 Docs site (A3) | Done | `0276ea1` |
| #106 P16-06 Waitlist pages (A5, A7) | Done | `1508f42` |
| #20 epic parent | Done | closes via #106 `fixes #20` |

**Notes:**
- Epic order: #101 → #102 → #103 → #105 → #107 → #104 → #106 (Lane S serial)
- #101 verifier FAIL (3c2): `NEXT_PUBLIC_APP_URL` missing from `marketingEnvSchema` — fixed `b8e5a1b`
- All `apps/marketing`; MDX via `next-mdx-remote` (#107 legal, #104 docs)
- Waitlist pages integrate #73 API; middleware guards `WAITLIST_ENABLED` / `LAUNCH_MODE=live`
- No new DB migrations
- `pnpm audit --audit-level=high` passes on this run
- `staging` ~33 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P18 epic #22 (CI scaffold) or P19 epic #23

## 2026-06-18 — P14 epic #18 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #90 P14-01 Dashboard page (B3) | Done | `bcc25f7` |
| #91 P14-02 Repository detail / run list (B4) | Done | `c7db407` |
| #92 P14-03 Run detail page (B6) | Done | `1021f69` |
| #93 P14-04 Repository settings (B5) | Done | `03897a7` |
| #94 P14-05 Insights page (B7) | Done | `213676c` |
| #18 epic parent | Done | closes via #94 `fixes #18` |

**Notes:**
- Epic order: #90 → #91 → #92 → #93 → #94 (Lane S serial)
- All frontend (apps/web); no DB migrations
- #91: conclusion filters client-side; cursor pagination
- #92: wave-based DAG layout with SVG connectors
- #93: admin/owner gate via RequireRole + canMutate
- #94: insights API + @pipewatch/ui charts/StatCards
- `pnpm audit --audit-level=high` passes on this run
- `staging` ~25 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P16 epic #20 (runs UI — check if superseded by P14) or P18 epic #22 (CI scaffold)

## 2026-06-17 — P17 epic #21 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #108 P17-01 Production Dockerfiles | Done | `9926bb8` |
| #109 P17-02 docker-compose.yml + .env.example | Done | `46feb25` |
| #21 epic parent | Done | closes via #109 `fixes #21` |

**Notes:**
- Epic order: #108 → #109 (Lane S serial)
- #108: multi-stage Dockerfiles (api/worker/web), API entrypoint migrate-then-start, GHCR docs in README, web `output: standalone`
- #109: CE compose stack (api, worker, web, postgres, redis); healthchecks + volumes; `PIPEWATCH_EDITION=ce`
- No new DB migrations (runtime migrate via API entrypoint)
- `pnpm audit --audit-level=high` passes on this run
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P18 epic #22 (CI scaffold) or P16 epic #20 (runs UI)

## 2026-06-17 — P15 epic #19 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #95 P15-01 Workspace settings general (B8) | Done | `dc860d5` |
| #96 P15-02 Members settings (B9) | Done | `97677a4` |
| #97 P15-03 Integrations settings (B10) | Done | `72d02ed` |
| #98 P15-04 API keys settings (B11) | Done | `38f0436` |
| #99 P15-05 Billing settings (B12) | Done | `375ac0c` |
| #100 P15-06 Account settings (B13) | Done | `c52280f` |
| #19 epic parent | Done | closes via #100 `fixes #19` |

**Notes:**
- Epic order: #95 → #96 → #97 → #98 → #99 → #100 (Lane S serial)
- Board sync fix: #97 was stuck In Progress after verify — orchestrator set Done
- Follow-ups flagged (non-blocking): member self-leave may 403 (#96); API keys `created_by` not in list API (#98)
- No new DB migrations
- `pnpm audit --audit-level=high` passes on this run
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P16 epic #20 (runs UI) or P18 #22 CI scaffold

## 2026-06-17 — P13 epic #17 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #86 P13-01 Sign in page (B1) | Done | `c5f9f2d` |
| #87 P13-02 CE bootstrap page (B0) | Done | `5d398f2` |
| #88 P13-03 Onboarding wizard (B2) | Done | `3c89cb9` |
| #89 P13-04 Invite accept page (B18) | Done | `c36cf3d` |
| #17 epic parent | Done | closes via #89 `fixes #17` |

**Notes:**
- Epic order: #86 → #87 → #88 → #89 (Lane S serial)
- No new DB migrations
- `pnpm audit --audit-level=high` passes on this run
- `staging` 12 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P14 epic #18 (dashboard pages) or P18 #22 CI scaffold

## 2026-06-17 — P12 epic #16 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #78 P12-01 App layout, theme, fonts | Done | `8bd018d` |
| #80 P12-03 Shared UX primitives | Done | `3d7aa2d` |
| #79 P12-02 App shell (sidebar, top bar) | Done | `163b60a` |
| #81 P12-04 API client + auth cookies | Done | `3692a81` |
| #82 P12-05 Role gating + edition guards | Done | `a4c0e39` |
| #83 P12-06 SSE client hook | Done | `dc73380` |
| #84 P12-07 API docs link in shell | Done | `ef17152` |
| #85 P12-08 CE bootstrap middleware | Done | `895bb50` |
| #16 epic parent | Done | closes via #85 `fixes #16` |

**Notes:**
- Epic order: #78 → #80 → #79 → #81 → #82 → #83 → #84 → #85 (Lane S serial)
- #83 execution left uncommitted once — resumed agent committed `dc73380`
- No new DB migrations
- `pnpm audit --audit-level=high` passes on this run
- `staging` 8 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P13 epic #17 (dashboard pages) or P18 #22 CI scaffold

## 2026-06-17 — P11 epic #15 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #75 P11-01 Stripe checkout + portal API | Done | `b7241ed`, `19950bf` (linkage cherry-pick) |
| #76 P11-02 Stripe webhook handler | Done | `fc76ea4` |
| #77 P11-03 Plan enforcement middleware | Done | `5c82fb6` |
| #15 epic parent | Done | closes via #77 `fixes #15` |

**Notes:**
- Epic order: #75 → #76 → #77 (Lane S serial)
- **Commit-linkage fix:** #75 commit `f6a73db` was board Done but missing on `staging` (same class as P3 #41) — cherry-picked as `b7241ed` + fix `19950bf`
- #76 verifier FAIL (3c2): `STRIPE_WEBHOOK_SECRET` missing in Phase Development — fixed without new commit; re-verify PASS
- No new DB migrations (workspace Stripe columns from P2)
- `pnpm audit --audit-level=high` passes on this run
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P12 epic #16 (dashboard UI shell) or P18 #22 CI scaffold

## 2026-06-17 — P10 epic #14 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #72 P10-01 GitHub webhook receiver | Done | `0af9779` |
| #73 P10-02 Waitlist API (cloud) | Done | `a25e990` |
| #74 P10-03 Postmark webhook (cloud) | Done | `65b1d57` |
| #14 epic parent | Done | closes via #74 `fixes #14` |

**Notes:**
- Epic order: #72 → #73 → #74 (Lane S serial)
- #74 verifier FAIL (3c2): `POSTMARK_WEBHOOK_SECRET` missing in Phase Development — fixed without new commit; re-verify PASS
- No new DB migrations (#41 subscribers schema reused)
- `pnpm audit --audit-level=high` passes on this run
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P11 epic #15 (dashboard UI) or P18 #22 CI scaffold

## 2026-06-17 — P9 epic #13 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #70 P9-01 SSE token endpoint | Done | `7ae001e` |
| #71 P9-02 SSE stream + broadcaster | Done | `9821291` |
| #13 epic parent | Done | closes via #71 `fixes #13` |

**Notes:**
- Epic order: #70 → #71 (Lane S serial; #71 depends on #70 + worker/run APIs)
- No DB migrations (Redis token + pub/sub only)
- `pnpm audit --audit-level=high` passes on this run
- `staging` ~2 commits ahead of `origin/staging` from this run (not pushed)

**Next suggested:** P10 epic #14 (webhooks ingest) or P18 #22 CI scaffold

## 2026-06-17 — P8 epic #12 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #65 P8-01 Pipeline runs API | Done | `1f805dd` (prior run, verified this session) |
| #66 P8-02 Pipeline jobs & steps API | Done | `f0cd0df` |
| #67 P8-03 Workspace dashboard aggregates | Done | `2d0d038` |
| #68 P8-04 Insights API | Done | `b2a6a2f` |
| #69 P8-05 Sync / backfill status API | Done | `3a9458d` |
| #12 epic parent | Done | closes via #69 `fixes #12` |

**Notes:**
- Epic order: #65 → #66 → #67 → #68 → #69 (Lane S serial; #67/#68 not parallelized due to shared apps/api hot files)
- #65 was already In Review with commit on staging at run start — verifier-only batch 1
- No new DB migrations in P8 (pipeline schema from P2)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` ~4 commits ahead of `origin/staging` from this run (#66–#69; #65 was prior)

**Next suggested:** P9 epic #13 (webhooks ingest) or P18 #22 CI scaffold

## 2026-06-17 — P7 epic #11 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #60 P7-01 Queue infrastructure | Done | `d3fccd4` |
| #61 P7-02 Pipeline run/job handlers | Done | `b87f3d5` |
| #62 P7-03 Backfill jobs | Done | `0712674` |
| #63 P7-04 Polling lifecycle | Done | `01bd19d` |
| #64 P7-05 Retention cleanup | Done | `4731c70` |
| #11 epic parent | Done | closes via #64 `fixes #11` |

**Notes:**
- Epic order: #60 → #61 → #62 → #63 → #64 (Lane S serial)
- #64 interrupted by turbo resource exhaustion; fixed via killing stale `@turbo/linux-64` processes + `TURBO_CONCURRENCY=1` for CI
- No new DB migrations in P7 (BullMQ uses Redis; pipeline schema from P2)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` ~10 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P8 epic #12 (webhooks ingest) or P18 #22 CI scaffold

## 2026-06-17 — P6 epic #10 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #59 P6-05 Webhook payload mappers | Done | `3efc922` |
| #55 P6-01 GitHub App auth client | Done | `dd79e2d` |
| #56 P6-02 Integrations REST API | Done | `28158db` |
| #57 P6-03 Install callback route | Done | `cfdb5fb` |
| #58 P6-04 Repositories API | Done | `2eaf2d7` |
| #10 epic parent | Done | closes via #58 `fixes #10` |

**Notes:**
- Epic order: #59 → #55 → #56 → #57 → #58 (Lane S serial per suggested deps)
- No new DB migrations in P6 (integrations/repos schema from P2)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P7 epic #11 (queue infrastructure) or P18 #22 CI scaffold

## 2026-06-17 — P5 epic #9 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #50 P5-01 Workspaces CRUD | Done | `3fb8cbb` |
| #51 P5-02 Members API | Done | `99fbf35` |
| #54 P5-05 Email service | Done | `564d98f` |
| #52 P5-03 Invites API | Done | `d64e6d4` |
| #53 P5-04 API keys CRUD | Done | `f18289f` |
| #9 epic parent | Done | closes via #53 `fixes #9` |

**Notes:**
- Epic order: #50 → #51 → #54 → #52 → #53 (per suggested implementation order)
- No new DB migrations in P5 (workspace_invites + api_keys schema from P2)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P6 epic #10 (integrations) or P18 #22 CI scaffold

## 2026-06-17 — P3 #7 + P4 #8 combined orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON · **Interleaved** P3/P4 per cross-epic deps

| Issue | Status | Commit(s) |
|---|---|---|
| #42 P3-01 Hono + OpenAPI | Done | `cb7f2a5` (prior run) |
| #44 P3-03 edition guards | Done | `8688c93` (prior run) |
| #45 P4-01 GitHub OAuth | Done | `75b32ee` |
| #49 P4-05 bootstrap status | Done | `1bfda41` |
| #46 P4-02 refresh/logout/switch | Done | `04da695` |
| #43 P3-02 workspace scoping | Done | `efa7e8b` |
| #47 P4-03 API key auth | Done | `680fdd1` + fix `fad3151` |
| #41 P2-05 api_keys/subscribers | Done | `1023cf8` (cherry-pick linkage; schema on staging) |
| #48 P4-04 user profile/delete | Done | `45067f7` |
| #7 epic parent | Done | closes via #43 |
| #8 epic parent | Done | closes via #48 |

**Notes:**
- Cross-epic dep chain: #43 blocked on #45 → interleaved P4 before P3-02
- #41 `6080f19` was board Done but missing on `staging` until cherry-pick `1023cf8` (`fixes #41`)
- Commit-linkage audit: every Done issue must have `fixes #N` on `staging` (orchestrator skill updated)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` ahead of `origin/staging` (not pushed)

**Next suggested:** P5 epic #9 (workspaces API) or P18 #22 CI scaffold

**Re-verify 2026-06-17:** Full batch PASS @ `fad3151` — all leaves + epics Done; migration audit clean (#41 `0003_chief_alex_wilder` on staging)

## 2026-06-17 — P2 epic #6 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #37 P2-01 Drizzle setup | Done | `0ae56e0` |
| #38 P2-02 users/auth/workspaces | Done | `9777ba5` |
| #39 P2-03 integrations/repos | Done | `887b0d6` |
| #40 P2-04 pipeline tables | Done | `6fa6c2c` |
| #41 P2-05 api_keys/subscribers | Done | `6080f19` |
| #6 epic parent | Done | closes via #41 `fixes #6` |

**Notes:**
- 4 Drizzle migrations generated (0000–0003); integration harness still stub (#114)
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` 11 commits ahead of `origin/staging` (not pushed)

**Next suggested:** P3 epic #7 (API bootstrap) or P18 #22 for CI scaffold (#30 blocked on #110)

## 2026-06-17 — P0 epic #4 orchestrator run

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #25 P0-01 monorepo init | Done | `3cf1487` |
| #26 P0-02 edition flags | Done | `36e5a52` |
| #27 P0-03 types/utils | Done | `6f01801`, `6bab935` (env fix) |
| #28 P0-04 app scaffolds | Done | `f6c31e4`, `1965578` (env fix) |
| #29 P0-05 env validation | Done | `c2d3182` |
| #4 epic parent | Done | (closes via #29 commit `fixes #4`) |
| #30 P0-06 Sentry CI | Ready | **Blocked** on #110 |

**Follow-ups (non-blocking):**
- Add `*.tsbuildinfo` to `.gitignore` and untrack committed artifacts (#25 advisory)
- `pnpm audit --audit-level=high` fails on pre-existing esbuild/vitest advisory
- Phase Development: confirm `REDIS_URL` / new env keys registered by operator

**Next suggested:** P1 epic #5 or unblocked #30 after #110 (P18 CI scaffold).

## 2026-06-17 — P1 epic #5 orchestrator run (complete)

**Lane:** S on `staging` · **GitHub sync:** ON

| Issue | Status | Commit(s) |
|---|---|---|
| #31 P1-01 design tokens | Done | `e14110d` |
| #32 P1-02 core components | Done | `e62be4e` |
| #33 P1-03 form & feedback | Done | `7fc2ae3` |
| #34 P1-04 data components | Done | `201fe5f` |
| #35 P1-05 brand + charts | Done | `3aab367` |
| #36 P1-06 app composites | Done | `7d0d936` |
| #5 epic parent | Done | closes via #36 `fixes #5` |

**Notes:**
- App global `import '@pipewatch/ui/styles.css'` deferred to P12-01
- `pnpm audit --audit-level=high` still fails on pre-existing esbuild advisory
- `staging` 6 commits ahead of `origin/staging` (not pushed)
