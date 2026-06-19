# PipeWatch audit checklist — domains & attack surfaces

Per-domain checks for a full audit. For each item: find the owning code, confirm the control, record pass/gap with severity. Paths are starting points — verify, don't assume.

---

## 1. Authentication & sessions

Code: `apps/api/src/services/auth/{jwt,refresh-token,oauth,api-key}.ts`, `apps/api/src/routes/auth/**`. Spec: PRD §7.1, §20.

- [ ] **JWT signing** — HS256 with `JWT_SECRET` (≥32 chars, no default); refresh tokens signed with separate `JWT_REFRESH_SECRET`. No key confusion (`alg:none`, RS/HS mix).
- [ ] **Access token TTL** short (~15min); `exp`/`iat` validated; no long-lived JWTs.
- [ ] **Refresh tokens** stored hashed (`sha256`) in `refresh_tokens`; **rotated** on every `/auth/refresh`; old token revoked (`revoked_at`) → replay rejected.
- [ ] **Logout** revokes current token; `/auth/logout-all` revokes all for the user.
- [ ] **API keys** (`pw_` prefix) stored as `sha256(key)` only, never plaintext; shown once; workspace-scoped; honor `expires_at` and `revoked_at`; constant-time hash compare; `last_used_at` updated.
- [ ] **OAuth CSRF** — `state` is signed + bound to an httpOnly cookie and verified on callback (`OAUTH_STATE_COOKIE_NAME`); state cookie cleared after use; short maxAge.
- [ ] **Open redirect** — the `next` param on `/auth/github` and `/invite/:token` must be validated (relative-only or allowlisted host) before redirect. Reject `//evil.com`, `https://evil.com`, `javascript:`.
- [ ] **OAuth token exchange** failures don't leak `client_secret`; errors return generic 4xx/502.
- [ ] **Account linking** — `upsertGitHubUser` keys on stable `github_id`, not mutable email; no takeover via email collision.
- [ ] **First-user bootstrap** (CE) — `wasFirstUser` admin grant can't be replayed once users exist.

## 2. Authorization & multi-tenancy (highest priority)

Code: `apps/api/src/middleware/workspace-scope.ts`, `api-key-auth.ts`, route handlers, `services/**`. Spec: PRD §5, §15; Decision #31.

- [ ] **Every** `/api/v1/workspaces/:workspaceId/**` route resolves and **enforces membership** in that workspace before any read or write — no route trusts the path param alone.
- [ ] **IDOR / cross-workspace leak** — every query filters by `workspace_id`; nested resources (`repoId`, `runId`, `jobId`, `keyId`, `inviteId`) verified to belong to the workspace, not just to exist. This is the #1 risk class for this app.
- [ ] **Role gating** — `member` is read-only; settings/membership/API-key/billing mutations require `admin`/`owner`. Verify server-side, not just UI.
- [ ] **JWT `workspaceId` vs path `workspaceId`** — switching workspace requires `/auth/switch-workspace` (new JWT); a JWT for workspace A can't act on workspace B by changing the URL.
- [ ] **Denormalized `workspace_id`** on hot tables (`pipeline_runs`, `pipeline_jobs`) is set correctly on write and used in filters — no stale/missing tenant tag.
- [ ] **Invite flow** — token unguessable, single-use, expiring; accepting an invite can't escalate role or join an unintended workspace; revoked invites rejected.
- [ ] **Member removal / role change** doesn't allow demoting/removing the last `owner`; self-privilege-escalation blocked.
- [ ] **FK cascade on workspace delete** is explicit and complete — no orphaned tenant data left readable.

## 3. Webhook security

Code: `apps/api/src/lib/github-webhook-signature.ts`, `postmark-webhook-signature.ts`, `routes/webhooks/{github,stripe,postmark}.ts`, `services/stripe-webhook-handler.ts`. Spec: PRD §4.4; Decision #4.

- [ ] **GitHub** — verify `X-Hub-Signature-256` (HMAC-SHA256 over raw body) with `timingSafeEqual` **before** parsing/processing. Invalid → 401, **no side effects**. No bypass flag/env.
- [ ] **Raw body** used for HMAC (not re-serialized JSON); body parser doesn't mutate before verification.
- [ ] **Stripe** (cloud) — `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`; signature verified before handling; only expected event types acted on.
- [ ] **Postmark** (cloud) — signature/basic-auth verified before processing bounce/unsubscribe.
- [ ] **Replay / idempotency** — duplicate webhook deliveries don't double-apply state (GitHub redelivery, Stripe retries); consider delivery-id / event-id dedupe.
- [ ] **Payload trust** — webhook payload fields (repo names, run data) are validated and treated as untrusted before DB upsert and before queueing into BullMQ.
- [ ] **DoS** — large/malformed payloads bounded; signature check is cheap and first.

## 4. Input validation & injection

Code: route schemas (`@hono/zod-openapi`), `packages/types`, Drizzle queries. Spec: `03-security-baseline.mdc`.

- [ ] **All bodies/queries/params** validated server-side with Zod; unknown/extra fields rejected (`.strict()` where appropriate).
- [ ] **No raw SQL interpolation** — all DB access via Drizzle query builder; any `sql\`\`` template is parameterized, never string-concatenated with user input.
- [ ] **SSRF** — outbound GitHub fetches (`github-fetch.ts`) target only `api.github.com` / fixed hosts; no user-controlled URL/host; install-callback `installation_id` validated.
- [ ] **Path/param injection** — IDs are UUID-validated; pagination/sort params allowlisted (no arbitrary column ordering).
- [ ] **Mass assignment** — PATCH endpoints whitelist updatable fields; `role`, `workspace_id`, `id`, timestamps not client-settable.
- [ ] **ReDoS** — no user-input-driven catastrophic regex.
- [ ] **Email injection** — invite/welcome/waitlist templates escape user-controlled names; no header injection via address fields.

## 5. Secrets & configuration

Code: `packages/config/env.ts`, `strict-env-fields.ts`, `.env.example`, `apps/*/src/**/env*`. Spec: `03/05/09-*.mdc`, PRD §10, §23.

- [ ] **Startup validation** — required secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `GITHUB_WEBHOOK_SECRET`, `PIPEWATCH_EDITION`) fail-fast; no silent insecure defaults in production.
- [ ] **No secret in client bundle** — nothing sensitive under `NEXT_PUBLIC_*`; verify `apps/web` / `apps/marketing` env usage.
- [ ] **GitHub App private key** (`GITHUB_APP_PRIVATE_KEY`) handled as multiline secret, never logged, used only for short-lived installation tokens (`app-auth.ts`).
- [ ] **`.env` / `.env.local`** not committed; only `.env.example` (keys, no values) present.
- [ ] **Phase → GHA** — secrets sourced from GHA environments at deploy, never fetched from Phase at runtime; CI workflows reference `${{ secrets.* }}` only.
- [ ] **Secret entropy** — generated tokens (refresh, SSE, invite, API keys, waitlist confirm) use a CSPRNG with sufficient length.

## 6. Transport, cookies, CORS, headers

Code: `apps/api/src/app.ts`, cookie option builders, middleware.

- [ ] **Cookies** — refresh/access cookies `HttpOnly`, `Secure` (prod), `SameSite=Strict`; refresh cookie path-scoped. Confirm `secure` only relaxes in `NODE_ENV=development`.
- [ ] **CORS** — explicit per-environment allowlist; never `*` with credentials. Verify allowed origins match app/marketing domains.
- [ ] **Security headers** — HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/frame-ancestors, referrer policy, and a **CSP** on the web app. Note absence as Medium/Low.
- [ ] **HTTPS everywhere**; no mixed content; API/web/marketing on expected hosts.
- [ ] **No tokens in URLs** that get logged — SSE `?token=` is acceptable (60s, one-time) but must not be logged; check access-log redaction.

## 7. SSE real-time

Code: `apps/api/src/services/{sse-token,sse-broadcaster}.ts`, `routes/sse-token.ts`, `routes/workspaces/repos/stream.ts`. Spec: PRD §19.

- [ ] **One-time SSE token** — minted authenticated, stored in Redis with 60s TTL, **deleted on first use**; not reusable.
- [ ] **Stream authorization** — connecting to `:workspaceId/repos/:repoId/stream` re-checks workspace membership and repo ownership; token for workspace A can't subscribe to workspace B.
- [ ] **Broadcast isolation** — events only fan out to subscribers of the owning workspace/repo; no cross-tenant event leakage.
- [ ] **Resource limits** — connection count bounded; heartbeat/cleanup prevents leaked connections.

## 8. Rate limiting & abuse

Public/abusable endpoints: `/auth/github*`, `/auth/refresh`, `/webhooks/*`, `/invite/:token*`, `/api/v1/waitlist*`, `/api/v1/sse-token`, API-key auth.

- [ ] **Brute force** — refresh-token and API-key auth attempts limited; failed-auth lockout/backoff.
- [ ] **Waitlist / invite** — double-opt-in and accept endpoints rate-limited per IP/email; no enumeration of valid emails or tokens (uniform responses + timing).
- [ ] **Plan limits** (cloud) — `middleware/plan-limits.ts` enforces repo/workspace/member caps server-side; can't be bypassed via API.
- [ ] **Expensive endpoints** — insights/dashboard aggregates and backfill triggers protected from abuse.
- [ ] **Token-guess endpoints** — invite/waitlist confirm tokens are high-entropy and not enumerable.

## 9. Logging, observability & data exposure

Code: `apps/api/src/sentry.ts`, logging middleware, error handler. Spec: `03-security-baseline.mdc` logging list.

- [ ] **Never logged**: passwords/hashes, JWTs, refresh tokens, API keys (`pw_*`), full `Authorization` headers/cookies, `*_SECRET`/`*_KEY`, `GITHUB_APP_PRIVATE_KEY`, DB connection strings, Stripe payloads with PII, GitHub installation tokens.
- [ ] **Sentry** — PII scrubbing / `beforeSend` redaction; request bodies and headers sanitized before capture.
- [ ] **Error responses** — generic to clients; no stack traces, SQL, or internal paths leaked in API error envelopes.
- [ ] **Webhook/debug logging** doesn't dump raw signed payloads.

## 10. Dependencies, supply chain & CI/CD

Spec: `06-local-ci-before-commit.mdc`, `08-dependabot-alerts.mdc`, PRD §22.

- [ ] **`pnpm audit --audit-level=high`** clean; open Dependabot alerts triaged via version bump (never dismissed).
- [ ] **Lockfile integrity** — single `pnpm-lock.yaml`; no stray npm/yarn lockfiles; no unexpected/transitive risky packages.
- [ ] **GitHub Actions** — least-privilege `permissions:`; pinned action versions; secrets via GHA environments; no `pull_request_target` with untrusted checkout; no secret echo.
- [ ] **Build provenance** — Docker images and deploy artifacts come from trusted CI only.

## 11. Edition-specific surface

Spec: `packages/config/edition.ts`, PRD §16, §25, §26.

- [ ] **No scattered edition checks** — all CE/Cloud divergence via `flags` from `packages/config/edition.ts`.
- [ ] **CE (Docker Compose, `25`)** — embedded Postgres/Redis not exposed publicly by default; secrets via env, not baked into images; webhook endpoint exposure (tunnel/polling) documented; auto-migrate at startup can't run destructively.
- [ ] **Cloud-only routes disabled in CE** — billing/Stripe/Postmark/waitlist endpoints inert when `BILLING_ENABLED`/cloud flags are off; no dead authenticated surface.
- [ ] **Setup/bootstrap** — CE `/setup` only active at user-count 0; Cloud redirects to sign-in; no re-bootstrap escalation.

See **[recommendations.md](recommendations.md)** for the CE vs Cloud threat-model split and the hardening backlog.
