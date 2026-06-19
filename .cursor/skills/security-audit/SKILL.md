---
name: security-audit
description: Run a high-level, whole-application security audit of PipeWatch (API, worker, web, marketing, CE Docker Compose). Maps attack surfaces, checks the OWASP-style vulnerability classes most relevant to a multi-tenant GitHub Actions dashboard, and verifies the security baseline. Use when the user asks to "audit security", "security audit", "review the security posture", "find vulnerabilities", "check attack surface", or harden PipeWatch CE / Cloud. For reviewing a single diff/PR, use the built-in security-review skill instead.
disable-model-invocation: true
---

# PipeWatch security audit

A **read-only, posture-level** audit of the whole codebase — not a single-diff review (that is the built-in `security-review` skill). Output is a findings report ranked by severity, mapped to real PipeWatch files and the security baseline in `.cursor/rules/03-security-baseline.mdc`.

**Default to read-only.** Never modify code, dismiss Dependabot alerts (`08-dependabot-alerts.mdc`), print secret values (`09-phase-secrets-handling.mdc`), or push. Propose fixes; only implement them if the user explicitly asks in a follow-up.

## Sources of truth

| Concern | Source |
|---|---|
| Security requirements | `.cursor/rules/03-security-baseline.mdc` + PRD §7.1, §4.4, §15 |
| Product/data model | `docs/internal/PipeWatch_MVP_PRD.md` |
| Edition split (CE vs Cloud) | `packages/config/edition.ts`, PRD §26 |
| Auth flow detail | PRD §20 |

When code and a spec doc disagree, the **code is the security reality** — flag the divergence.

## When to use

| User intent | Action |
|---|---|
| "Security audit", "audit PipeWatch security", "find vulns" | **Full audit** — all domains in `checklist.md` |
| "Audit auth" / "check webhook security" / "is multi-tenancy safe?" | **Scoped audit** — relevant domains only |
| "How do I harden CE?" / "make self-hosting secure" | **Hardening pass** — `recommendations.md` (CE focus) |
| "File these findings" / "ticket them" / "send to the board" | **Handoff** — `report-to-issues.md` → `github-intake` |
| "Review this PR/diff for security" | **Stop** — use built-in `security-review` skill instead |

## Audit workflow

Copy this checklist and track progress:

```
Security audit progress:
- [ ] 1. Scope — confirm full vs targeted; note CE / Cloud / both
- [ ] 2. Map attack surface — enumerate trust boundaries (see below)
- [ ] 3. Run domain checks — checklist.md, every applicable domain
- [ ] 4. Rate findings — severity + likelihood (see scale)
- [ ] 5. Recommend — fixes per finding + gaps from recommendations.md
- [ ] 6. Report — use the template; rank Critical → Info
- [ ] 7. (Optional) Handoff — file findings as issues via report-to-issues.md
```

### 1. Scope

Ask only if ambiguous: full vs targeted, and **which edition(s)** matter — CE self-hosters and Cloud have different threat models (`recommendations.md`). Default: full audit covering both.

### 2. Map the attack surface

PipeWatch trust boundaries to enumerate before digging in:

- **Public unauthenticated:** `/webhooks/github`, `/webhooks/stripe`, `/webhooks/postmark`, `/auth/github*`, `/invite/:token*`, `/api/v1/waitlist*`, `/health`, `/api/v1/sse-token` consumers, marketing site.
- **Authenticated API:** every `/api/v1/workspaces/:workspaceId/**` route — JWT (cookie/bearer) or `pw_` API key.
- **Outbound / SSRF-relevant:** GitHub API fetches (`services/github/github-fetch.ts`, `app-auth.ts`), SMTP/Postmark, Stripe.
- **Background:** BullMQ queues (`apps/worker`) processing attacker-influenced webhook payloads.
- **Data plane:** Postgres (Drizzle), Redis (SSE tokens, queues, rate-limit state).
- **Build/deploy:** GitHub Actions, Phase → GHA secret sync, Docker Compose (CE), Fly.io / Cloudflare (Cloud).

### 3. Run domain checks

Work through **[checklist.md](checklist.md)** — one section per domain. For each item: locate the responsible code, confirm whether the control exists, and record a finding (pass or gap). Use `Grep`/`Glob`/`SemanticSearch`; read the implementation, don't assume from the PRD.

### 4. Severity scale

Rate each finding by impact × exploitability:

| Severity | Meaning |
|---|---|
| 🔴 **Critical** | Cross-workspace data access, auth bypass, RCE, secret disclosure, unauthenticated mutation |
| 🟠 **High** | Privilege escalation within tenant, webhook signature bypass, SSRF, stored XSS |
| 🟡 **Medium** | Missing rate limit on abusable endpoint, weak cookie/CORS/CSP, info leak via errors |
| 🔵 **Low** | Defense-in-depth gaps, verbose logging, missing security headers with low impact |
| ⚪ **Info** | Hardening suggestions, future-proofing, doc/process gaps |

A theoretical issue with no reachable path is **Info**, not Critical — state the attack path or downgrade it.

### 5 & 6. Recommend and report

Pair every finding with a concrete fix referencing the exact file. Then pull forward systemic gaps from **[recommendations.md](recommendations.md)**. Present using the template below.

### 7. Handoff to github-intake (optional)

When the user wants findings turned into board work ("file these", "ticket them"), follow **[report-to-issues.md](report-to-issues.md)**: it maps each finding's severity → Priority, picks Bug vs Task, sets the domain label, and hands a ready payload to the **`github-intake`** skill (which creates the issues, requires approval, and stops at Ready). Apply the disclosure guard before filing 🔴/🟠 findings — never put exploit detail or secrets in a public issue.

## Report template

```markdown
# PipeWatch Security Audit — <scope> (<date>)

## Summary
<2–4 sentences: overall posture, count by severity, headline risks>

| Severity | Count |
|---|---|
| 🔴 Critical | N |
| 🟠 High | N |
| 🟡 Medium | N |
| 🔵 Low | N |
| ⚪ Info | N |

## Findings

### 🔴 [SEV] <short title>
- **Domain:** <Auth / Multi-tenancy / Webhooks / …>
- **Location:** `path/to/file.ts:LINE`
- **Attack path:** <how it's reached and abused>
- **Impact:** <what an attacker gains>
- **Fix:** <specific remediation + file>
- **Ref:** <PRD §x / rule / OWASP category>

<repeat, ranked Critical → Info>

## Hardening recommendations
<systemic gaps from recommendations.md — CE vs Cloud where they differ>

## What was checked & passed
<brief positive confirmations so the report is balanced>
```

## Hard rules

1. **Read-only by default** — audit and report; implement fixes only on explicit follow-up.
2. **Never print secret values** — refer to keys by name only (`09-phase-secrets-handling.mdc`). Don't run bulk `phase secrets` dumps.
3. **Never dismiss Dependabot alerts** — recommend the version bump path (`08-dependabot-alerts.mdc`).
4. **Verify against code**, not just the PRD — the PRD states intent; the code is the live attack surface.
5. **Always state the attack path** for Critical/High; no path → downgrade.
6. **Respect the edition split** — separate CE-only and Cloud-only findings; never propose scattered `process.env.PIPEWATCH_EDITION` checks (use `packages/config/edition.ts`).
7. **No new tools as workarounds** — never use browser automation or external scanners unless the user asks.

## Additional resources

- **[checklist.md](checklist.md)** — per-domain attack surfaces and vulnerability classes to check.
- **[recommendations.md](recommendations.md)** — hardening backlog and CE/Cloud-specific gaps to consider adding.
- **[report-to-issues.md](report-to-issues.md)** — map findings to `github-intake` (severity → Priority, Bug/Task, domain label) to file them as Ready issues.
