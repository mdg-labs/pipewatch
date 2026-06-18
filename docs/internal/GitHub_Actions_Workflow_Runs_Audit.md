# GitHub Actions workflow runs — audit vs PipeWatch

**Date:** 2026-06-18  
**Scope:** Compare GitHub’s official workflow-run / workflow-job documentation and REST API contracts with PipeWatch’s ingestion, storage, and UI handling.  
**Method:** Codebase review + GitHub docs (webhooks, REST Actions endpoints, workflow trigger reference). No code changes.

## Executive summary

PipeWatch’s core model — ingest `workflow_run` and `workflow_job` webhooks, map to vendor-neutral `pipeline_*` tables, backfill runs via REST, optional polling fallback — aligns with GitHub’s recommended integration surface for a read-only Actions dashboard.

The largest **functional gaps** are:

1. **Re-runs are not modeled** — GitHub keeps the same `run_id` across attempts (`run_attempt` increments); PipeWatch upserts on `external_run_id` only, so a re-run overwrites the prior attempt.
2. **Backfill/polling ingest runs only** — jobs and steps are webhook-only; historical run detail is incomplete until live events arrive.
3. **Polling is single-page and date-bucketed** — busy repos can miss runs between poll intervals.
4. **Several nullable GitHub fields are required in our schema** — `head_branch` and workflow `name` can be `null` from GitHub but `pipeline_runs.branch` and `pipeline_name` are `NOT NULL`.
5. **Internal docs drift** — PRD §12.6 lists webhook `action` values that do not match GitHub’s published event types.

Most other differences are **intentional simplifications** (collapsed conclusion values, three-value status model) documented below.

---

## GitHub reference (source of truth)

| Topic | Official reference |
|---|---|
| `workflow_run` webhook | [Webhook events — `workflow_run`](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run) |
| `workflow_job` webhook | [Webhook events — `workflow_job`](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job) |
| List workflow runs (REST) | [`GET /repos/{owner}/{repo}/actions/runs`](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-repository) |
| List jobs for a run (REST) | [`GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`](https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28#list-jobs-for-a-workflow-run) |
| Workflow trigger events | [`workflow_run` activity types](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run) |
| GitHub App permission | **Actions: Read** (repository permission) for both webhook events |
| Webhook security | [`X-Hub-Signature-256`](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) HMAC-SHA256 |

### GitHub `workflow_run` webhook

- **Availability:** GitHub App, repository, organization, enterprise webhooks.
- **Required permission:** Actions (read).
- **Published `action` values:** `requested`, `in_progress`, `completed`  
  (not `created` — see mismatch §1).
- **Payload:** `workflow_run` object plus `workflow` object.

### GitHub `workflow_job` webhook

- **Published `action` values:** `queued`, `in_progress`, `completed`, `waiting`  
  (PRD omits `waiting` — see mismatch §2).
- **Payload:** `workflow_job` object; may include `steps[]`.

### GitHub workflow run object (REST + webhook overlap)

Key fields PipeWatch uses or should be aware of:

| GitHub field | Type (REST) | PipeWatch mapping |
|---|---|---|
| `id` | integer | `external_run_id` (stringified) |
| `name` | string **or null** | `pipeline_name` (**NOT NULL** in DB) |
| `path` | string | `pipeline_definition_ref` |
| `status` | string or null | `status` via `mapGitHubStatus` |
| `conclusion` | string or null | `conclusion` via `mapGitHubConclusion` |
| `head_branch` | string **or null** | `branch` (**NOT NULL** in DB) |
| `head_sha` | string | `commit_sha` |
| `head_commit.message` | string (nullable path) | `commit_message` |
| `event` | string | `trigger_type` |
| `html_url` | string | `source_url` |
| `actor.login` | string | `actor_login` |
| `run_started_at` | string or null | `started_at` (fallback: `created_at`) |
| `updated_at` | string | `completed_at` when `status === completed` |
| `run_attempt` | integer | **not stored** |
| `triggering_actor` | user object | **not stored** (only `actor`) |
| `display_title` | string | **not stored** |
| `previous_attempt_url` | string or null | **not stored** |

**Status values (GitHub):** `queued`, `in_progress`, `completed`, `waiting`, `requested`, `pending` (jobs; runs can also surface waiting/pending/requested per list-filter docs).

**Conclusion values (GitHub):** `success`, `failure`, `cancelled`, `skipped`, `timed_out`, `action_required`, `neutral`, `stale`, `null` (while in progress).

### Re-runs and `run_attempt`

GitHub documents that `github.run_id` is stable across re-runs; `github.run_attempt` increments (starts at 1). Re-run URLs use `/actions/runs/{run_id}/attempts/{attempt_number}`. PipeWatch keys runs only on `run.id`, so **each re-run replaces the stored snapshot of the previous attempt**.

---

## PipeWatch architecture (as implemented)

```
GitHub App webhooks                REST backfill / poll
        │                                  │
        ▼                                  ▼
 POST /webhooks/github          GET …/actions/runs?created=>=…
 (HMAC verify, enqueue)                    │
        │                                  │
        ▼                                  ▼
 BullMQ `webhook-events`          `ingestWorkflowRuns`
   process-pipeline-run              mapRestWorkflowRun
   process-pipeline-job                      │
        │                                  │
        └──────────► upsert pipeline_runs / pipeline_jobs / pipeline_steps
                              │
                              ▼
                     SSE publish (run:*, job:updated)
```

**Code touchpoints:**

| Layer | Location |
|---|---|
| Webhook receiver | `apps/api/src/routes/webhooks/github.ts` |
| Run mapping | `packages/utils/src/github/map-workflow-run.ts` |
| Job/step mapping | `packages/utils/src/github/map-workflow-job.ts` |
| Status/conclusion | `packages/utils/src/github/github-status.ts` |
| Worker handlers | `apps/worker/src/handlers/process-pipeline-run.ts`, `process-pipeline-job.ts` |
| REST ingest | `apps/worker/src/services/github/backfill.ts` |
| Backfill job | `apps/worker/src/handlers/backfill-repo.ts` |
| Poll job | `apps/worker/src/handlers/poll-repo.ts` |
| Schema | `packages/db/schema/pipeline-runs.ts`, `pipeline-jobs.ts` |
| UI badges | `apps/web/src/lib/run-utils.ts`, `run-detail-utils.ts` |

**Aligned with PRD / onboarding:**

- GitHub App: Actions (read) + Metadata (read); subscribe to `workflow_run`, `workflow_job` — matches `InstallGitHubStep.tsx` and PRD §16.
- Webhook signature validation before processing — matches Decision #4.
- No raw log storage; `source_url` links to GitHub — matches Decision #6.

---

## Findings — mismatches and risks

Severity: **High** = data loss or incorrect user-visible state; **Medium** = incomplete coverage or doc drift; **Low** = intentional simplification or edge case.

### 1. PRD documents non-existent `workflow_run` action `created` — **Medium (doc drift)**

| Source | `workflow_run` actions |
|---|---|
| PRD §12.6 | `created`, `in_progress`, `completed` |
| GitHub webhooks | `requested`, `in_progress`, `completed` |
| Code (`process-pipeline-run.ts`) | SSE maps both `requested` **and** `created` → `run:created` |

**Impact:** `created` is dead code for real GitHub traffic; `requested` is the actual “run queued” signal. On re-runs, GitHub notes `requested` does **not** fire again.

**Recommendation:** Update PRD to `requested` and treat `created` as legacy/defensive only.

### 2. PRD omits `workflow_job` action `waiting` — **Low–Medium**

GitHub publishes `waiting` as a distinct job action (runner assignment delay). PipeWatch maps job **status** `waiting` → `queued` in `mapGitHubStatus`, but never documents the action. Processing still works (action is not gated), but operators may not expect `waiting` deliveries.

### 3. `run_attempt` not modeled — re-runs overwrite history — **High**

- Unique key: `(repo_id, external_run_id)` where `external_run_id = String(workflow_run.id)`.
- GitHub re-runs reuse `id`, increment `run_attempt`.
- Jobs API defaults to `filter=latest`; re-run creates new job executions under the same run id.

**Impact:** After “Re-run failed jobs”, PipeWatch shows only the latest attempt. Prior attempt jobs/steps are replaced or orphaned depending on `external_job_id` reuse.

**Recommendation (future):** Store `run_attempt` (and optionally key jobs by attempt), or treat each attempt as a distinct logical run for display.

### 4. Backfill and polling do not ingest jobs/steps — **High (UX gap)**

- `ingestWorkflowRuns` only upserts `pipeline_runs`.
- No call to `GET …/actions/runs/{run_id}/jobs` during backfill or poll.
- `process-pipeline-job` requires parent run to exist (`process-pipeline-job.ts`).

**Impact:** Run list populates after backfill, but **run detail job graph is empty** until webhooks arrive (or forever in polling-only CE setups with no webhook path).

**Recommendation:** Optional backfill phase: for each ingested run, fetch jobs (paginated) and upsert.

### 5. Polling fetches only the first page (max 100 runs) — **High (busy repos)**

`poll-repo.ts` calls `fetchWorkflowRunsPage(..., page: 1, ...)` once per interval.

**Impact:** Repos with >100 runs in the poll window (since `last_synced_at` or retention cutoff) miss older-in-window runs. GitHub also caps filtered searches at **1,000 results** when using `created` (documented on list-runs endpoint).

### 6. Poll `created` filter uses date-only granularity — **Medium**

`resolvePollCreatedSince` returns `YYYY-MM-DD`. GitHub’s `created` parameter supports full date-time search syntax, but PipeWatch passes a date.

**Impact:** Intra-day poll windows re-fetch the entire day’s runs (wasteful) yet still limited to page 1 (contradictory pressure).

### 7. Nullable GitHub fields vs NOT NULL DB columns — **Medium**

| Field | GitHub | PipeWatch `pipeline_runs` |
|---|---|---|
| `workflow_run.name` | string or null | `pipeline_name` NOT NULL |
| `workflow_run.head_branch` | string or null | `branch` NOT NULL |

**Impact:** Fork-edge cases and certain event types can deliver `null` branch; mapping would insert `null` into NOT NULL columns (runtime/DB error) or coerced empty string (misleading UI).

### 8. `completed_at` derived from `updated_at` — **Low–Medium**

`map-workflow-run.ts` sets `completedAt` from `updated_at` when status is `completed`. GitHub does not expose a dedicated `completed_at` on workflow runs (unlike jobs). `updated_at` can change if run metadata is touched post-completion.

**Impact:** Minor duration/timestamp skew vs GitHub UI in edge cases.

### 9. Conclusion collapse — **Low (intentional, but lossy)**

`mapGitHubConclusion` maps GitHub-only conclusions to `failure`:

- `timed_out`, `action_required`, `neutral`, `stale` → `failure`
- Unknown conclusions → `failure`

GitHub’s list-runs `status` filter treats `neutral`, `stale`, `timed_out`, etc. as first-class states. PipeWatch UI cannot distinguish “timed out” from “failed”.

**Aligned:** PRD §6 lists only `success | failure | cancelled | skipped | null`.

### 10. `mapGitHubStatus` default → `completed` — **Medium (defensive risk)**

Unknown `status` strings fall through to `"completed"` in `github-status.ts`.

**Impact:** A new GitHub status would be stored as completed (possibly with null conclusion), showing a false success badge in UI (`run-utils.ts` defaults non-failure completed to success).

**Recommendation:** Default to `in_progress` or reject/log unknown statuses.

### 11. `workflow_job` before `workflow_run` race — **Medium**

If job webhook is processed before run webhook, `processPipelineJob` throws (`Pipeline run not found`). Webhook queue retries: 3 attempts, backoff 1s / 5s / 30s.

**Impact:** Usually self-heals; permanent failure if run webhook never arrives (disabled repo mid-flight, delivery loss).

### 12. No `X-GitHub-Delivery` idempotency — **Low**

GitHub may redeliver webhooks. Upserts by external id make reprocessing mostly safe, but SSE may emit duplicate `run:created` events.

### 13. REST backfill forces synthetic webhook action `completed` — **Low**

`mapRestWorkflowRun` wraps REST rows as `{ action: "completed", workflow_run: run }` regardless of actual status. Mapping uses payload fields, so **in-progress runs backfilled from REST retain correct status**; only SSE typing would be wrong if REST path published SSE (it does not today).

### 14. `actor` vs `triggering_actor` — **Low**

GitHub distinguishes the user who triggered the run (especially `schedule`, `workflow_dispatch`) from `actor`. PipeWatch stores only `actor.login`.

**Impact:** Scheduled runs may show the wrong “who triggered” in UI vs GitHub.

### 15. SSE client patches `completed_at` incorrectly — **Medium (UI)**

`apps/web/src/lib/run-utils.ts` and `run-detail-utils.ts` set `completed_at` to `summary.startedAt` when `status === "completed"` (SSE summary does not include `completed_at`).

**Impact:** Live-updated runs can show wrong completion time in the dashboard/detail until full refetch.

### 16. `job:updated` SSE ignored on run list — **Low (by design)**

`applySseEventToRuns` no-ops for `job:updated`. Run list status does not refresh when jobs finish if run-level `workflow_run` webhook is delayed.

### 17. Unsupported GitHub events (expected for MVP) — **Info**

Not handled (returns 200, no enqueue): `check_run`, `check_suite`, `workflow_dispatch`, `installation`, `push`, etc. Correct for GitHub Actions–centric MVP; workflows triggered only via `workflow_dispatch` still produce `workflow_run` events.

### 18. CE webhook URL path vs API routing — **Verify ops**

PRD §16 examples use `https://pipewatch.yourdomain.com/webhooks/github`. API route is `POST /webhooks/github` on the API host (`api.pipewatch.app` in cloud). Ensure CE/docs distinguish **web app origin vs API origin** for webhook configuration.

---

## Coverage matrix

| Capability | GitHub provides | PipeWatch |
|---|---|---|
| Run created/queued | `workflow_run` `requested` | Upsert run; SSE `run:created` |
| Run in progress | `workflow_run` `in_progress` | Upsert; SSE `run:updated` |
| Run completed | `workflow_run` `completed` | Upsert; SSE `run:completed` |
| Job queued/waiting | `workflow_job` `queued`/`waiting` | Upsert job (needs parent run) |
| Job in progress | `workflow_job` `in_progress` | Upsert job |
| Job completed + steps | `workflow_job` `completed` + `steps[]` | Upsert job; replace steps |
| Historical runs | REST list runs | Backfill + poll (runs only) |
| Historical jobs | REST list jobs for run | **Not implemented** |
| Re-run attempts | Same `run_id`, new `run_attempt` | **Overwrites** |
| Run logs | REST logs redirect | Link via `source_url` only (PRD Decision #6) |
| Delete run on GitHub | Admin delete API | **No tombstone** — stale row remains |
| Webhook signature | `X-Hub-Signature-256` | Enforced (`github-webhook-signature.ts`) |
| Rate limits | `X-RateLimit-*` headers | Backfill client reads headers (`backfill.ts`) |

---

## Intentional alignments (not mismatches)

- **Vendor-neutral schema** (`pipeline_*`, `external_*`) with GitHub mapping at worker boundary — Decision #37.
- **Three-state status model** (`queued`, `in_progress`, `completed`) — collapses GitHub pre-run states sensibly.
- **Webhook-first realtime** with optional polling — PRD §4.4, Decision #2.
- **Enabled-repo filter** on webhook ingest — disabled repos return 200 without enqueue.
- **Job steps replaced on each job upsert** — matches GitHub’s full step list in webhook payload.
- **GitHub App permissions** documented in onboarding match GitHub’s minimum (Actions read).

---

## Verification log (second pass)

Re-read this document against GitHub docs and codebase on 2026-06-18:

| Claim | Re-verified |
|---|---|
| `workflow_run` actions are `requested`, `in_progress`, `completed` | Yes — [GitHub webhook docs](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run), octokit/webhooks.js schema |
| `workflow_job` includes `waiting` action | Yes — same webhook docs §workflow_job |
| `head_branch` nullable on REST | Yes — list-runs response schema (`string or null`) |
| `name` nullable on REST | Yes — list-runs response schema |
| `run_attempt` on workflow run object | Yes — REST schema includes `run_attempt` |
| PipeWatch poll uses page 1 only | Yes — `poll-repo.ts` line 79 |
| Job handler requires parent run | Yes — `process-pipeline-job.ts` + integration test |
| Conclusion mapping | Yes — `github-status.ts` |
| PRD §12.6 `created` action | Yes — `PipeWatch_MVP_PRD.md` line 749 |
| Webhook events subscribed | Yes — `SUPPORTED_GITHUB_EVENTS` in `github.ts` |

---

## Suggested follow-ups (issues, not implemented here)

1. **Model `run_attempt`** or document “latest attempt only” as explicit product limitation.
2. **Backfill jobs** via `GET /actions/runs/{id}/jobs` for complete run detail.
3. **Fix poll pagination** — loop pages until empty or cursor, respect rate limits.
4. **Harden null `head_branch` / `name`** — nullable columns or sentinels.
5. **PRD correction** — `requested` not `created`; add `waiting` for jobs.
6. **SSE payload** — include `completed_at` in `PipelineRunSummary`; fix client patch logic.
7. **Unknown status handling** — fail safe instead of defaulting to `completed`.

---

## References

- PipeWatch PRD §4.4, §6, §12.6, §16, §18 — `docs/internal/PipeWatch_MVP_PRD.md`
- PipeWatch run lifecycle (customer docs) — `apps/marketing/content/docs/concepts/run-lifecycle.mdx`
- Test fixtures — `packages/utils/src/github/fixtures/`
