# PipeWatch hardening recommendations

Systemic gaps and defense-in-depth measures to weigh during an audit. These are **recommendations**, not blockers — rate each against the severity scale and the current PRD scope (don't propose explicit MVP non-goals from PRD §2 / rule `02-orchestrator.mdc` without flagging them as out-of-scope).

## Threat models differ by edition

| Dimension | CE (self-hosted) | Cloud (`cloud.pipewatch.app`) |
|---|---|---|
| Operator | The customer — owns the box, secrets, network | PipeWatch team |
| Tenancy | Usually single workspace, trusted users | Many untrusted tenants — isolation is paramount |
| Top risks | Weak deploy defaults, exposed Postgres/Redis, leaked webhook secret, no TLS | Cross-tenant data leakage, billing fraud, account takeover, noisy-neighbor DoS |
| Secrets | User-managed env / `.env` | Phase → GHA → Fly/CF |
| Network | Often a single VPS / homelab | Managed, segmented infra |

A finding can be **Critical for Cloud but Low for CE**, or vice versa. State which edition each recommendation targets.

## For self-hosters (CE)

- **Secure defaults over convenience** — ship Docker Compose with Postgres/Redis bound to the internal network only (never `0.0.0.0` published ports); no default/weak credentials; generate per-install secrets on first run rather than shipping placeholders.
- **Startup secret validation** — refuse to boot in production mode with missing/weak `JWT_SECRET`, `GITHUB_WEBHOOK_SECRET`, etc. (don't fall back to dev defaults).
- **Webhook exposure guidance** — document the safest path (Cloudflare Tunnel or polling mode) so users don't expose the whole box; ensure polling mode needs no inbound port.
- **TLS guidance** — make HTTPS the documented default (reverse proxy / tunnel terminates TLS); warn when `Secure` cookies are disabled.
- **Upgrade safety** — auto-migrations at API startup must be forward-only and non-destructive; document backup-before-upgrade.
- **Hardening doc** — a "Securing your PipeWatch CE instance" page in `pipewatch-docs` (firewall, secret rotation, least-privilege GitHub App permissions: Actions read + Metadata read only).
- **CSP / security headers** shipped on by default, not left to the operator's proxy.

## For Cloud

- **Tenant-isolation tests** — add integration/e2e tests that actively attempt cross-workspace IDOR on every resource (the failure mode here is Critical). Treat workspace-scope as a tested invariant, not a convention.
- **Rate limiting at the edge** — per-IP and per-token limits on auth, refresh, SSE-token, invite, and waitlist endpoints (Cloudflare + app-level). Brute-force and enumeration protection.
- **Billing integrity** — verify Stripe webhook signatures and reconcile plan state server-side; never trust client-reported plan; idempotent handling of Stripe retries.
- **Account takeover surface** — monitor OAuth state failures, refresh-token reuse (a reused rotated token is a breach signal → revoke the whole chain and alert).
- **Secrets rotation runbook** — `JWT_SECRET`/`JWT_REFRESH_SECRET` rotation strategy (dual-key grace window) so rotation doesn't force a global logout outage.
- **Abuse / DoS** — bound SSE connections per workspace, queue depth per tenant, and backfill concurrency to prevent noisy-neighbor impact.
- **Audit logging** — security-relevant events (logins, role changes, API-key create/revoke, member changes) recorded for incident response.

## Cross-cutting (both editions)

- **Refresh-token reuse detection** — on presentation of an already-rotated (revoked) refresh token, revoke all tokens for that user and surface a security event. Strong takeover signal.
- **API-key scoping** — consider per-key permission scopes / read-only keys beyond workspace scoping; surface `last_used_at` so users can spot leaked keys.
- **Content Security Policy** — a real CSP on `apps/web` and `apps/marketing` (Umami allowed only on marketing per Decision #15) closes most XSS escalation.
- **Dependency hygiene** — keep `pnpm audit` in the local gate green; automate Dependabot triage via the `dependabot-triage` skill; pin and review GitHub Actions.
- **Input strictness everywhere** — Zod `.strict()` on all inputs blocks mass-assignment and unknown-field smuggling by default.
- **SSRF allowlist** — centralize outbound HTTP so GitHub fetches can't be redirected to internal addresses; reject non-allowlisted hosts and link-local/metadata IPs.
- **Security regression tests** — encode the highest-value invariants (webhook signature required, workspace scoping enforced, secrets never logged) as tests so they can't silently regress.

## Possible additions to this skill (future)

If the audit surfaces recurring needs, consider extending `security-audit` with:

- A lightweight **threat-model template** (STRIDE per trust boundary) for new features before they ship.
- A **secrets-exposure scan** helper (grep patterns for accidentally committed `pw_*`, JWTs, private keys) — read-only, no values printed.
- Mapping each domain to **OWASP Top 10 / ASVS** identifiers for compliance-style reporting.
