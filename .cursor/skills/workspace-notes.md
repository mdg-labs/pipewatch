# PipeWatch workspace notes

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
