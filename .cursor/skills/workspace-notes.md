# PipeWatch workspace notes

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
