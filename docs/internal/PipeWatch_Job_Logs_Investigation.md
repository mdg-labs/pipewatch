# Per-job logs in PipeWatch — investigation

**Date:** 2026-06-21  
**Status:** Draft / pre-decision  
**Scope:** Architecture options for showing per-job logs on run detail (B6), storage choices, streaming feasibility, and GitHub API rate-limit avoidance.  
**Method:** PRD + Page Inventory review, codebase audit, GitHub REST docs, industry references (Buildkite, Depot, Blacksmith, Octotail/stare), reverse-engineered runner protocol (chimera). **No code changes.**

**Related:**

- PRD Decision #6 — no log storage; link to GitHub ([`PipeWatch_MVP_PRD.md`](./PipeWatch_MVP_PRD.md) §27)
- Page Inventory B6 — run detail; logs link via `source_url` only ([`PipeWatch_Page_Inventory.md`](./PipeWatch_Page_Inventory.md))
- Workflow runs audit — current ingestion gaps ([`GitHub_Actions_Workflow_Runs_Audit.md`](./GitHub_Actions_Workflow_Runs_Audit.md))

---

## Executive summary

Showing per-job logs inside PipeWatch is **post-MVP** and requires revisiting **Decision #6**. Today we store run/job/step **metadata only** and link to GitHub for full logs.

The constraint that drives everything: **PipeWatch is a GitHub App aggregator, not a CI platform.** We do not control runners. Logs are produced on GitHub’s infrastructure and reach third parties only via **pull APIs** (or undocumented internal WebSockets used by github.com).

**Recommendations:**

| Layer | Recommendation |
|---|---|
| **Raw log bytes** | **Object storage** (R2 on Cloud, volume on CE) — not Postgres |
| **Postgres** | Metadata only: `source_url`, fetch status, `storage_key`, size, timestamps |
| **Ingestion** | **Fetch once** when job completes (worker) — GitHub is source, PipeWatch is serving layer |
| **Live tail** | Not via official GitHub APIs; optional phase 2 = Redis buffer + gated polling while viewers exist |
| **Search stack** | Skip ELK/Loki/ClickHouse for v1 “read this job’s log”; revisit for cross-repo search / v1.3 AI |

**Do not:** store multi-MB logs in Postgres, proxy GitHub on every UI poll, or depend on undocumented WebSocket APIs in production.

---

## Current state in PipeWatch

| Area | Today |
|---|---|
| Run logs | `pipeline_runs.source_url` → “View on GitHub” on B6 |
| Job logs | No per-job URL stored; GitHub `html_url` present in webhooks but **dropped** in `map-workflow-job.ts` |
| Schema | `pipeline_jobs`: metadata only (`external_job_id`, status, steps, runner, timing) |
| Ingestion | `workflow_job` webhooks → upsert job + steps; no log fetch |
| GitHub App perms | **Actions: Read** — sufficient for log download REST endpoints |
| PRD | Decision #6: no raw log ingestion; deferred partial capture (failed steps, last N lines) for v1.3 AI |

---

## Two industry models (do not conflate)

| Model | Who owns execution? | How logs reach the UI |
|---|---|---|
| **CI platform** (Buildkite, CircleCI, Jenkins, Depot, Blacksmith) | Platform or its runner | Runner **pushes** stdout/stderr to control plane in real time |
| **GitHub aggregator** (PipeWatch) | GitHub | Third party **pulls** logs via REST (or polls) after/during execution |

**Buildkite:** agent streams output to Buildkite; logs archived in managed S3 (or customer S3 on Enterprise). [Agent docs](https://buildkite.com/docs/agent) · [Managing log output](https://buildkite.com/docs/pipelines/configure/managing-log-output)

**Depot / Blacksmith:** control the runner machine — fork `actions/runner` or tail with OpenTelemetry → ClickHouse for analytics + serving. [Depot](https://depot.dev/blog/we-instrumented-github-actions) · [Blacksmith](https://www.blacksmith.sh/blog/logging)

PipeWatch cannot replicate the push path without (a) becoming a runner provider, or (b) customer workflow changes.

---

## What GitHub officially provides

### REST log endpoints

| Endpoint | Behavior |
|---|---|
| `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` | **302** → signed URL (expires **~1 minute**) on `pipelines.actions.githubusercontent.com` |
| `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs` | **302** → ZIP archive of entire run |
| `GET .../runs/{run_id}/attempts/{attempt_number}/logs` | Same pattern per re-run attempt |

Docs: [Workflow jobs REST API](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run) · [Workflow runs REST API](https://docs.github.com/en/rest/actions/workflow-runs#download-workflow-run-logs)

**Notes:**

- Client must follow redirects (`curl -L`); auth via installation token (private repos need `repo` scope equivalent).
- Response is often a **ZIP** (run-level always; job-level may be plain text or archive depending on client/docs — treat as binary archive until parsed).
- Webhooks carry **no log bodies** — only status, steps, timing.

### Rate limits (installation token)

- Base **5,000 requests/hour** per installation; scales with repos/users up to **12,500**; GHEC orgs **15,000**. [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- **Failure mode:** polling GitHub every few seconds for many active jobs — not “one user opened one log”.

### Retention

- GitHub deletes workflow logs after ~**90 days** (repo settings). PipeWatch can only show older logs if it copied them earlier.

### Re-runs

- Same `run_id`, incrementing `run_attempt`; job IDs change on full re-run. Logs must be keyed by `(run_id, external_job_id, run_attempt)` — see workflow runs audit.

---

## Is real-time streaming from GitHub possible?

### Official answer: **no** supported log stream API for GitHub Apps

There is no documented WebSocket or SSE endpoint that accepts an **installation access token** and streams job log lines.

### What GitHub uses internally (undocumented)

Reverse-engineered from `actions/runner` ([chimera `gh-protocol.md`](https://github.com/quinck-io/chimera/blob/main/docs/gh-protocol.md)):

| Component | Role |
|---|---|
| `pipelines.actions.githubusercontent.com` | Legacy VSS: log line upload, timeline |
| Results Twirp API | Modern: append blobs, step metadata |
| `feed.actions.githubusercontent.com` | WebSocket live console for github.com UI |
| Azure append blobs | Durable log storage behind the scenes |

Runners upload lines in batches (~1s or 64 KB). Live UI WebSocket uses a **per-job access token** from the runner manifest — not available to PipeWatch’s GitHub App.

### Community “live tail” tools

| Tool | Approach | Production viability |
|---|---|---|
| [Octotail](https://github.com/getbettr/octotail) | Headless browser + mitmproxy → extract WebSocket subscription | CLI hack; fragile |
| [stare](https://github.com/javascripter/stare) | Playwright + persisted GitHub browser session → same WebSocket | CLI; no App auth model |
| [github-websocket-pipeline-api](https://github.com/Hacksore/github-websocket-pipeline-api) | Reverse-engineering `pipelines.actions.githubusercontent.com` | Research only |

**Stack Overflow consensus:** real-time push from Actions to your server is not supported; download API after completion, or monitor runner log files on self-hosted machines. [SO #77550119](https://stackoverflow.com/questions/77550119/is-it-possible-to-send-workflow-log-to-web-server-in-real-time)

### In-progress jobs — even GitHub’s UI is limited

- Active step logs may show only **recent lines** on page load, then stream forward ([actions/runner#2131](https://github.com/actions/runner/issues/2131)).
- Export actions (e.g. [export-workflow-logs](https://github.com/timorthi/export-workflow-logs)) document **404 while workflow still running** — logs API oriented to completed work.

### What PipeWatch *can* stream

| Direction | Feasible? | Mechanism |
|---|---|---|
| GitHub → PipeWatch (official, real-time) | **No** | — |
| GitHub → PipeWatch (poll) | **Partial** | Slow poll + dedupe; rate-limit sensitive |
| PipeWatch → browser | **Yes** | SSE (already used for run status) or WebSocket from **our** Redis/R2 |

---

## Storage: Postgres vs object storage vs “log server”

| Store | Use for job logs? | Notes |
|---|---|---|
| **Postgres (blob/text)** | **No** | MB-scale rows, backup bloat, Neon cost; wrong tool |
| **Postgres (metadata)** | **Yes** | `job_id`, `storage_key`, `byte_size`, `fetch_status`, `fetched_at`, `expires_at` |
| **Object storage (R2/S3/volume)** | **Yes — default for raw logs** | Industry norm; GitHub uses blob storage internally |
| **Redis (TTL)** | **Yes — hot path** | Buffer while job running or cache recent fetches |
| **Elasticsearch / OpenSearch** | **Overkill for v1** | Full-text search across huge corpus; heavy ops |
| **Grafana Loki** | **Overkill for v1** | Label-based log aggregation; another service to run |
| **ClickHouse** | **Phase 3 / analytics** | Blacksmith, large CI vendors; terabyte-scale search + aggregates |

**Rule:** Postgres indexes **pointers**; object storage holds **bytes**. “Doc indexing” (ELK) only pays off when the product promise is **search all CI output**, not **open one job’s log**.

---

## Rate-limit avoidance

**GitHub is the ingestion source, not the serving layer.**

| Pattern | GitHub API cost |
|---|---|
| Fetch once when job completes | **1 call / job** |
| Serve all user views from PipeWatch storage | **0** |
| Poll every 5s × 20 active jobs | **~14,400 calls/hour** |
| Proxy every page view to GitHub | **Unbounded** |

Implement fetch in the **worker** on `job:completed` (or lazy once on first view with `fetching…` UI), then serve from R2/volume forever until retention purge.

---

## Implementation options

### Option A — On-demand proxy (minimal Decision #6 change)

User opens job → API fetches from GitHub → unzip → return text. Optional Redis TTL cache.

| Pros | Cons |
|---|---|
| No blob infra | Slow first open; repeat GitHub load without cache |
| Stays close to “no archival” | Dead after GitHub 90-day expiry |
| Same code path CE + Cloud | Pseudo-live = polling GitHub |

### Option B — Fetch on complete + object storage (**recommended default**)

```
workflow_job completed → worker enqueues fetch-job-logs
  → one GitHub call + redirect download
  → store in R2 (Cloud) / volume (CE)
  → Postgres metadata row

User opens job panel → GET .../jobs/:id/logs from PipeWatch only
  → optional SSE chunks while reading stored file
```

| Pros | Cons |
|---|---|
| Fast repeat views | Not live until job completes (phase 1) |
| Low GitHub API usage | New infra + retention policy |
| Enables future search/AI on copy | Revises Decision #6 (bounded archival) |
| Matches CI industry pattern (S3) | |

Community parallel: [export-workflow-logs](https://github.com/marketplace/actions/export-workflow-run-logs) pushes run ZIP to S3 after `workflow_run` completes.

### Option C — Partial capture only (Decision #6 alternate)

Store **last N lines** or **failed-job logs only** — bridges to PRD §29.1 AI “failed-run resolution” without full archival.

### Option D — Redis buffer + gated polling (live phase 2)

While `in_progress` **and** `watchers > 0`: poll GitHub every 10–30s, append delta to Redis stream, fan out via PipeWatch SSE. On complete: flush to R2, drop Redis.

| Pros | Cons |
|---|---|
| Feels live in-app | Still not true GitHub live; partial in-progress API |
| Bounded GitHub cost (viewer-gated) | Redis + polling complexity |

### Option E — Link to GitHub for live (status quo+)

Store `pipeline_jobs.source_url` (`html_url`); in-app logs only for completed jobs or never. Zero rate-limit risk.

### Option F — Opt-in workflow forwarding

Customer adds PipeWatch action posting log chunks to our API during the job. True live; high adoption friction; secrets land in our storage.

### Option G — Undocumented WebSocket (Octotail/stare)

**Not recommended** for production — breaks without notice, wrong auth model for workspace GitHub App.

---

## Recommended phased plan

### Phase 1 — Shippable in-app logs (completed jobs)

1. **Schema:** `pipeline_jobs.source_url`; optional `pipeline_job_log_artifacts` (metadata only).
2. **Storage:** Cloudflare R2 (Cloud); Compose volume (CE).
3. **Worker:** fetch each job log once on `job:completed` (or lazy on first view).
4. **API:** `GET /workspaces/.../runs/.../jobs/:jobId/logs` — workspace-scoped, member read OK; tail/offset query params.
5. **UI:** virtualized log panel in B6 `JobPanel`; loading / error / empty states; i18n; “Open on GitHub” fallback.
6. **Ops:** max response size + truncate message; align blob TTL with repo `retention_days`.

### Phase 2 — Approximate live (if required)

7. Redis buffer + viewer-count-gated polling while `in_progress`.
8. PipeWatch SSE from Redis; honest UX copy (“may lag ~15s”).

### Phase 3 — Search / AI (PRD v1.3)

9. ClickHouse or partial failure-log capture; cross-repo query patterns.

---

## Build checklist (any phase)

### Product / PRD

- [ ] Revise Decision #6 scope (proxy vs persist vs partial).
- [ ] Retention: mirror GitHub 90d vs repo `retention_days` vs plan-gated.
- [ ] Edition: CE disk quota vs Cloud R2 billing.
- [ ] Security: logs may contain secrets; UI disclaimer.

### Backend

- [ ] GitHub log client: resolve owner/repo, `githubFetch`, follow 302, unzip, order step files.
- [ ] Re-run correctness: `(run_id, external_job_id, run_attempt)`.
- [ ] Rate-limit log endpoints per workspace.

### Frontend (B6)

- [ ] Log panel in expanded job panel; step filter optional.
- [ ] Virtualized scroll for large output.
- [ ] Failed jobs auto-expanded (existing behavior) + log visible.

### Tests

- [ ] Unit: ZIP parse, tail truncation, ordering.
- [ ] Integration: mocked GitHub 302 + zip fixture.
- [ ] E2e: expand failed job → log lines visible (mock GitHub).

---

## Open product decisions

| Question | Options |
|---|---|
| Persist or proxy? | In-app on open only vs store every completed job |
| Live tail required? | Polling OK vs must match GitHub UI |
| Retention | GitHub 90d only vs PipeWatch `retention_days` |
| Scope | All jobs vs failed jobs only |
| Infra on CE | Local volume size limits vs link-only on CE |

---

## References

| Resource | URL |
|---|---|
| GitHub — Download job logs | https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run |
| GitHub — Download run logs | https://docs.github.com/en/rest/actions/workflow-runs#download-workflow-run-logs |
| GitHub — REST rate limits | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| Chimera — runner protocol (logs + WebSocket) | https://github.com/quinck-io/chimera/blob/main/docs/gh-protocol.md |
| Octotail (live tail hack) | https://github.com/getbettr/octotail |
| stare (live tail CLI) | https://github.com/javascripter/stare |
| export-workflow-logs (S3 export action) | https://github.com/timorthi/export-workflow-logs |
| Buildkite agent | https://buildkite.com/docs/agent |
| Depot — runner instrumentation | https://depot.dev/blog/we-instrumented-github-actions |
| Blacksmith — ClickHouse logging | https://www.blacksmith.sh/blog/logging |
| actions/runner — active step log limits | https://github.com/actions/runner/issues/2131 |
| PipeWatch customer docs (retention note) | `pipewatch-docs` — `concepts/run-lifecycle.mdx` |

---

*Investigation doc — MDG Labs — June 2026*
