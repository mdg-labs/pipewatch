# PipeWatch workspace notes

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
