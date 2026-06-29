# PipeWatch — job logs & failure context (investigation)

**Date:** 2026-06-22 (merged from 2026-06-21 technical investigation + 2026-06-22 approaches catalog)  
**Status:** Draft — **current product stance: metadata only** (Decision #6 unchanged)  
**Scope:** How PipeWatch could surface per-job logs or failure context on run detail (B6): GitHub platform limits, storage, streaming, rate limits, and a full approach catalog.  
**Method:** PRD + Page Inventory review, codebase audit, GitHub REST docs/roadmap, industry references (Buildkite, Depot, Blacksmith, OTel, Marketplace actions, Octotail/stare), reverse-engineered runner protocol (chimera). **No code changes.**

**Related:**

- PRD Decision #6 — no log storage; link to GitHub ([`PipeWatch_MVP_PRD.md`](./PipeWatch_MVP_PRD.md) §27)
- Page Inventory B6 — run detail; logs link via `source_url` only ([`PipeWatch_Page_Inventory.md`](./PipeWatch_Page_Inventory.md))
- Workflow runs audit — ingestion gaps ([`GitHub_Actions_Workflow_Runs_Audit.md`](./GitHub_Actions_Workflow_Runs_Audit.md))

---

## Executive summary

There is **no reliable, zero-config way** for a GitHub App aggregator to get live or full job logs for every connected repo. GitHub’s public surface remains **metadata via webhooks** + **bulk log download via REST** (302 → short-lived ZIP URL). No first-party streaming log API for third parties as of June 2026.

**Current decision:** stay **metadata only** — run/job/step status, failed step names, run-level “View on GitHub”. Decision #6 unchanged.

The core constraint: **PipeWatch is a GitHub App aggregator, not a CI platform.** We do not control runners. Logs are produced on GitHub’s infrastructure and reach third parties only via **pull APIs** (or undocumented internal WebSockets used by github.com).

**If logs are revisited later**, ranked by practicality:

| Rank | Approach | Why |
|---|---|---|
| 1 | **Per-job deep links** (A1) | Zero ingestion; persist `html_url` we already drop from webhooks |
| 2 | **Opt-in PipeWatch Action** (A6) | Push model; customer `GITHUB_TOKEN` pays fetch cost |
| 3 | **App pull — failure excerpts only** (A4) | One API call per failure; small Postgres payloads |
| 4 | **App pull — full logs → object storage** (A3) | Best in-app UX; highest infra cost |
| — | **Watch GitHub Actions Data Stream** (A12) | Enterprise preview; metadata today, log lines not promised |
| ✗ | Undocumented WebSocket / headless browser (A13) | Not production-viable |
| ✗ | Poll GitHub on every live view (A5) | Rate limits and fragility |

**Storage rule (if any log bytes are stored):** Postgres for **metadata/pointers** and **small failure excerpts**; object storage (R2/volume) for **full logs** — never multi-MB blobs in Postgres.

**Do not:** proxy GitHub on every UI poll, or depend on undocumented WebSocket APIs in production.

---

## Current product decision & codebase state

PipeWatch is a **visibility and triage** layer:

- Webhooks → `pipeline_runs` / `pipeline_jobs` / `pipeline_steps` (status, conclusion, timing)
- B6 highlights failed jobs/steps; full log text stays on GitHub
- Decision #6 unchanged

| Area | Today |
|---|---|
| Run logs | `pipeline_runs.source_url` → “View on GitHub” on B6 |
| Job logs | No per-job URL; GitHub `html_url` in webhooks but **dropped** in `map-workflow-job.ts` |
| Schema | `pipeline_jobs` / `pipeline_steps`: metadata only |
| Ingestion | `workflow_job` webhooks → upsert job + steps; no log fetch |
| GitHub App perms | **Actions: Read** — sufficient for log download REST |
| PRD | Decision #6: no raw log ingestion; partial capture deferred for v1.3 AI |

**Already available without log ingestion:**

| Signal | Source | In DB/UI today? |
|---|---|---|
| Run failed | `workflow_run` webhook | Yes |
| Job failed | `workflow_job` webhook | Yes |
| Step failed (name + conclusion) | `workflow_job.steps[]` | Yes |
| Error message / stack trace | — | **No** |
| Per-job GitHub URL | `workflow_job.html_url` | **No** (not persisted) |

### What webhooks will and will not give you

Confirmed against fixtures and [`map-workflow-job.ts`](../../packages/utils/src/github/map-workflow-job.ts):

```json
{
  "name": "Run tests",
  "status": "completed",
  "conclusion": "failure",
  "number": 2,
  "started_at": "...",
  "completed_at": "..."
}
```

**No** `error`, `message`, `output`, or log lines. “Exact errors per run” **cannot** come from webhooks alone — only **which step failed**. Error text requires pull (A4), push (A6), or sparse Checks output (A9).

---

## GitHub platform landscape (researched June 2026)

### Unchanged since initial investigation

| Capability | Status | Reference |
|---|---|---|
| Log content in webhooks | **Not available** | [workflow_job payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job) |
| GraphQL log bodies | **Not available** | [SO #74054176](https://stackoverflow.com/questions/74054176/how-to-write-a-graphql-query-to-retrieve-all-the-workflows-runs-from-github) |
| Public REST log streaming | **Not available** on github.com | [Workflow jobs REST](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run) |
| Job/run log download | `GET .../logs` → **302** → ~1 min signed URL → ZIP/text | Same REST docs |
| Live tail for third-party apps | **Not available** via supported APIs | [actions/runner#2131](https://github.com/actions/runner/issues/2131) |

### REST log endpoints

| Endpoint | Behavior |
|---|---|
| `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` | **302** → signed URL on `pipelines.actions.githubusercontent.com` |
| `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs` | **302** → ZIP of entire run |
| `GET .../runs/{run_id}/attempts/{attempt_number}/logs` | Same per re-run attempt |

Docs: [Workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run) · [Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#download-workflow-run-logs)

- Client must follow redirects (`curl -L`); auth via installation token.
- Treat response as binary archive until parsed (often ZIP).
- Rate limits: **5,000 req/hr** base per installation, up to **12,500**; GHEC **15,000**. [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- GitHub deletes logs after ~**90 days**. Re-runs: key by `(run_id, external_job_id, run_attempt)` — see workflow runs audit.

### UI-only (not usable by PipeWatch API)

[GitHub roadmap #839](https://github.com/github/roadmap/issues/839) (**shipped** Apr 2024): github.com shows **last ~1,000 lines** on running jobs, then streams via internal WebSocket — not exposed to GitHub Apps.

### Watch list — new / upcoming

#### Actions Data Stream — [roadmap #1193](https://github.com/github/roadmap/issues/1193)

| Field | Detail |
|---|---|
| **Status** | Open; Enterprise preview; GHES 3.23; roadmap Q3 2026 |
| **Streams today** | Job states, runner labels, triggers, action versions |
| **Future** | “Network logs” — **not** workflow stdout/stderr yet |
| **Sink** | S3, Azure Event Hubs ([2026 security blog](https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/)) |

Monitor for enterprise; **do not plan on log lines** until GitHub documents them.

#### Gitea cursor log API (not GitHub)

[Gitea PR #37515](https://github.com/go-gitea/gitea/pull/37515) — reference design only; does not apply to github.com.

---

## Two industry models (do not conflate)

| Model | Who owns execution? | How logs reach the UI |
|---|---|---|
| **CI platform** (Buildkite, CircleCI, Depot, Blacksmith) | Platform or its runner | Runner **pushes** stdout/stderr in real time |
| **GitHub aggregator** (PipeWatch) | GitHub | Third party **pulls** via REST (or customer push via Action) |

[Buildkite agent](https://buildkite.com/docs/agent) · [Depot](https://depot.dev/blog/we-instrumented-github-actions) · [Blacksmith](https://www.blacksmith.sh/blog/logging)

PipeWatch cannot replicate the push path without (a) becoming a runner provider (A14), or (b) customer workflow changes (A6/A7).

---

## Is real-time streaming from GitHub possible?

### Official answer: **no** for GitHub Apps

No documented WebSocket/SSE endpoint accepts an **installation access token** and streams job log lines.

### Internal GitHub machinery (undocumented)

From [chimera `gh-protocol.md`](https://github.com/quinck-io/chimera/blob/main/docs/gh-protocol.md):

| Component | Role |
|---|---|
| `pipelines.actions.githubusercontent.com` | Legacy log upload, timeline |
| Results Twirp API | Append blobs |
| `feed.actions.githubusercontent.com` | WebSocket live console (github.com UI) |
| Azure append blobs | Durable storage |

Live UI uses **per-job access token** from runner manifest — not available to PipeWatch’s GitHub App.

### Community tools (reject for product)

| Tool | Approach |
|---|---|
| [Octotail](https://github.com/getbettr/octotail) | Headless browser + mitmproxy → WebSocket |
| [stare](https://github.com/javascripter/stare) | Playwright + saved browser session |
| [github-websocket-pipeline-api](https://github.com/Hacksore/github-websocket-pipeline-api) | Reverse-engineering research |

[SO #77550119](https://stackoverflow.com/questions/77550119/is-it-possible-to-send-workflow-log-to-web-server-in-real-time): not supported; use download API after completion or self-hosted runner log files.

### What PipeWatch *can* stream

| Direction | Feasible? | Mechanism |
|---|---|---|
| GitHub → PipeWatch (official, real-time) | **No** | — |
| GitHub → PipeWatch (poll) | **Partial** | Slow poll; rate-limit sensitive (A5, phase-2 buffer) |
| PipeWatch → browser | **Yes** | SSE from Redis/R2 after we own a copy |

[export-workflow-logs](https://github.com/timorthi/export-workflow-logs): log API returns **404 while workflow still running**.

---

## Storage & rate limits

### Where to put bytes

| Store | Use for job logs? | Notes |
|---|---|---|
| **Postgres (large blobs)** | **No** | MB rows, backup bloat, Neon cost |
| **Postgres (metadata + excerpts)** | **Yes** | Pointers, `failure_excerpt` ~KB |
| **Object storage (R2/S3/volume)** | **Yes** for full logs | Industry norm |
| **Redis (TTL)** | **Yes** | Hot buffer / cache |
| **ELK / Loki / ClickHouse** | **Overkill for v1** | Cross-repo search / v1.3 AI only |

**Rule:** Postgres indexes **pointers**; object storage holds **full log bytes**.

### Rate-limit avoidance

**GitHub is the ingestion source, not the serving layer.**

| Pattern | GitHub API cost |
|---|---|
| Fetch once when job completes | **1 call / job** |
| Serve views from PipeWatch storage | **0** |
| Poll every 5s × 20 active jobs | **~14,400 calls/hour** |
| Proxy every page view to GitHub | **Unbounded** |

---

## Approach catalog

Scoring: **Reliability** · **Coverage** (auto vs opt-in) · **Live** · **App API cost** · **Infra** · **Decision #6**

### A0 — Metadata only + run-level GitHub link *(current)*

Webhooks only. B6 “View on GitHub” uses `pipeline_runs.source_url`.

| | |
|---|---|
| Reliability ★★★★★ · Coverage 100% · Live status via SSE · App cost none · Infra none · Decision #6 ✅ |

**Gaps:** No per-job link; no error text.

### A1 — Metadata + per-job deep links *(low-hanging fruit)*

Persist `workflow_job.html_url` → `pipeline_jobs.source_url`. “Open job log on GitHub” on failed steps.

| | |
|---|---|
| Reliability ★★★★★ · Coverage 100% · Live on GitHub · App cost none · Infra minimal · Decision #6 ✅ |

Best **incremental** UX win without log ingestion.

### A2 — Enhanced failure UI (webhook data only)

Surface: “`build` → step `Run tests` failed”; rejected-job hint (empty `steps[]`).

| | |
|---|---|
| Reliability ★★★★★ · Coverage 100% · Infra UI+i18n only · Decision #6 ✅ |

Still no error message body.

### A3 — App pull: full job logs on complete → object storage

On `workflow_job` `completed`: fetch logs → R2 (Cloud) / volume (CE) → serve via PipeWatch API.

| | |
|---|---|
| Reliability ★★★★☆ · Coverage 100% auto · Live ❌ · App cost 1/job · Infra R2+retention · Decision #6 ❌ |

```
workflow_job completed → worker fetch-job-logs → R2/volume → Postgres metadata
User → GET .../jobs/:id/logs (never GitHub on read path)
```

### A4 — App pull: failure excerpts only → Postgres

Failed jobs only: download once, parse failed steps, extract `##[error]` + last N lines (~KB).

| | |
|---|---|
| Reliability ★★★★☆ · Coverage 100% auto · App cost 1/**failed** job · Infra minimal · Decision #6 ⚠️ partial |

Best **automatic** middle ground for error hints without full archival.

### A5 — App pull: on-demand proxy (no persistence)

Fetch from GitHub on each panel open; optional Redis TTL.

| | |
|---|---|
| Reliability ★★★☆☆ · App cost per view · Decision #6 ⚠️ |

Avoid as primary pattern.

### A6 — Opt-in PipeWatch Action: `workflow_run` forwarder

Customer adds workflow (`on: workflow_run: types: [completed]`). Action uses `GITHUB_TOKEN` to download logs, POSTs to PipeWatch ingest API.

| | |
|---|---|
| Reliability ★★★★☆ · Coverage opt-in · Live ❌ · App cost **zero** for fetch · Decision #6 ✅ opt-in |

Patterns: [export-workflow-logs](https://github.com/marketplace/actions/export-workflow-run-logs), [gh-logs-to-loki](https://github.com/sathishkumar-p/gh-logs-to-loki).

| Variant | Upload | Storage |
|---|---|---|
| A6a — failed steps only | Small | Postgres |
| A6b — full job logs | Large | R2/volume |
| A6c — org reusable workflow | Same | Easier rollout |

Most **reliable push model** without App rate-limit pain.

### A7 — Opt-in PipeWatch Action: in-job stream wrapper

`uses: pipewatch/run-with-logs@v1` wraps steps; streams stdout/stderr during execution.

| | |
|---|---|
| Reliability ★★★☆☆ · Coverage very low · Live ★★★★★ · Infra Redis+ingest |

Only if live tail is mandatory and customers accept workflow edits.

### A8 — BYO log shipper (Loki / OTel)

Customer runs [gh-logs-to-loki](https://github.com/sathishkumar-p/gh-logs-to-loki), [Grafana githubactionsreceiver](https://github.com/grafana/grafana-ci-otel-collector), or [OTel githubreceiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/githubreceiver). PipeWatch does not host logs.

Document as “bring your own”; not a PipeWatch feature unless we integrate a sink (unlikely).

### A9 — Checks API enrichment

On failure, fetch check run `output.title` / `summary` / `text` / `annotations` when workflows publish them.

| | |
|---|---|
| Reliability ★★☆☆☆ · Coverage sparse · May need Checks: Read |

Supplement only.

### A10 — Workflow artifacts convention

On failure, workflow uploads `pipewatch-failure.txt` artifact; PipeWatch downloads via artifacts API.

| | |
|---|---|
| Reliability ★★☆☆☆ · Coverage opt-in |

Worse than A6 unless artifacts already exist.

### A11 — `GITHUB_STEP_SUMMARY` scraping

Not viable — no dedicated API; opt-in author behavior.

### A12 — GitHub Actions Data Stream

Enterprise stream → S3/Event Hub; PipeWatch consumes events. **Metadata now**; log lines TBD.

Roadmap watch — do not block metadata-only stance.

### A13 — Undocumented WebSocket / headless browser

**Reject** (A13 = former Option G).

### A14 — Runner provider / fork `actions/runner`

**Out of scope** for PipeWatch.

---

## Comparison matrix

| ID | Approach | Reliable | Auto coverage | Live tail | App API load | New infra | Fits metadata-only |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **A0** | Metadata + run link | ✅ | 100% | Status | None | None | ✅ current |
| **A1** | + per-job GitHub links | ✅ | 100% | On GitHub | None | Minimal | ✅ |
| **A2** | + failure summary UI | ✅ | 100% | — | None | UI | ✅ |
| A3 | App pull full logs | ✅ | 100% | ❌ | High | R2 | ❌ |
| A4 | App pull failure excerpt | ✅ | 100% | ❌ | Low | Minimal | ⚠️ |
| A5 | On-demand proxy | ⚠️ | 100% | ⚠️ | Very high | Low | ⚠️ |
| A6 | PipeWatch Action forwarder | ✅ | Opt-in | ❌ | None | Action+ingest | ✅ opt-in |
| A7 | Action in-job stream | ⚠️ | Opt-in | ✅ | None | Stream stack | ✅ opt-in |
| A8 | BYO Loki/OTel | ✅ | Opt-in | Varies | None | None | ✅ |
| A9 | Checks API | ⚠️ | Sparse | ❌ | Low | Minimal | ⚠️ |
| A10 | Artifacts convention | ⚠️ | Opt-in | ❌ | Medium | Blob | ⚠️ |
| A11 | Step summary scrape | ❌ | Sparse | ❌ | — | — | ❌ |
| A12 | Actions Data Stream | TBD | Enterprise | Metadata | TBD | Consumer | TBD |
| A13 | Undocumented WS | ❌ | — | ✅ | — | — | ❌ |
| A14 | Own runners | ✅ | N/A | ✅ | N/A | Massive | ❌ |

---

## Recommended path if product revisits logs

Assuming **metadata-only stays the default**:

| Phase | Content |
|---|---|
| **0 (now)** | A0; optionally **A1 + A2** without Decision #6 change |
| **1** | **A6a** PipeWatch Action (failure excerpts) + ingest API; document in `pipewatch-docs` |
| **2** | **A4** automatic failure excerpts if customers won’t install actions; amend Decision #6 to partial capture |
| **3** | **A3** full logs + retention; **A7** only if live required |
| **Watch** | **A12** Actions Data Stream when log events are documented |

### Build checklist (when implementing any log phase)

**Product / PRD:** Decision #6 scope · retention vs `retention_days` · CE vs Cloud gating · secrets disclaimer

**Backend:** GitHub log client (302, unzip, step order) · re-run keys · ingest API (A6) · rate limits · redaction

**Frontend (B6):** log panel or excerpt under failed step · virtualized scroll · i18n · GitHub fallback

**Tests:** ZIP parse unit tests · mocked 302 integration · e2e failed-job excerpt

---

## Open questions

| # | Question |
|---|---|
| 1 | Ship A1 per-job deep links while metadata-only? |
| 2 | Would customers add per-repo `workflow_run` workflow (A6)? |
| 3 | Is automatic A4 acceptable amendment to Decision #6? |
| 4 | Enterprise design partner for A12 Data Stream? |
| 5 | Cloud-only logs vs CE action-only? |

---

## References

| Resource | URL |
|---|---|
| GitHub — workflow_job webhook | https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job |
| GitHub — download job logs | https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run |
| GitHub — download run logs | https://docs.github.com/en/rest/actions/workflow-runs#download-workflow-run-logs |
| GitHub — check runs | https://docs.github.com/en/rest/checks/runs |
| GitHub — REST rate limits | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| GitHub roadmap — UI scrollback (shipped) | https://github.com/github/roadmap/issues/839 |
| GitHub roadmap — Actions Data Stream | https://github.com/github/roadmap/issues/1193 |
| GitHub blog — Actions 2026 security roadmap | https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/ |
| Chimera — runner protocol | https://github.com/quinck-io/chimera/blob/main/docs/gh-protocol.md |
| Octotail · stare | https://github.com/getbettr/octotail · https://github.com/javascripter/stare |
| export-workflow-logs · gh-logs-to-loki | https://github.com/timorthi/export-workflow-logs · https://github.com/sathishkumar-p/gh-logs-to-loki |
| Grafana githubactionsreceiver · OTel githubreceiver | https://github.com/grafana/grafana-ci-otel-collector · https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/githubreceiver |
| gh CLI `--log-failed` | https://cli.github.com/manual/gh_run_view |
| Buildkite · Depot · Blacksmith | https://buildkite.com/docs/agent · https://depot.dev/blog/we-instrumented-github-actions · https://www.blacksmith.sh/blog/logging |
| actions/runner — active step limits | https://github.com/actions/runner/issues/2131 |
| Customer docs (retention) | `pipewatch-docs` — `concepts/run-lifecycle.mdx` |

---

*Investigation doc — MDG Labs — June 2026*
