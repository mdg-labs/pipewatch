# Access-log redaction — SSE `token=` query params

Operator guidance for Fly.io (API/worker) and Cloudflare (web/marketing) access logs. Complements Sentry `beforeSend` scrubbing in `@pipewatch/utils` (`scrubSentryEvent`).

## Background

SSE streams authenticate with a short-lived one-time token passed as a query parameter:

```
GET /api/v1/workspaces/:workspaceId/repos/:repoId/stream?token=<one-time-token>
```

Tokens expire in ~60 seconds (PRD §7.3). Reverse-proxy and platform access logs often record the full request URL, which can persist the token for the log retention window even after expiry.

**Sentry scrubbing does not cover platform access logs** — operators must configure redaction at the edge or in log shipping.

## What to redact

| Pattern | Example | Action |
|---|---|---|
| SSE token query param | `?token=abc123` | Replace value with `[REDACTED]` or omit param |
| Authorization header | `Authorization: Bearer …` | Omit or redact (also covered by Sentry scrubber) |
| Cookie header | `Cookie: refresh_token=…` | Omit or redact (also covered by Sentry scrubber) |

Redact **only the value** of `token=`; preserve path and other query params for debugging.

## Fly.io (API + worker)

Fly HTTP access logs include the request line and may include query strings depending on log source.

1. **Prefer structured app logging** — avoid logging full request URLs in application code; use path-only or `requestId` correlation.
2. **Log shipping filters** — when forwarding Fly logs to Datadog, Grafana Loki, or similar, apply a transform that strips or redacts `token=` before indexing:
   - Regex (illustrative): `([?&]token=)[^&\s"]+` → `$1[REDACTED]`
3. **Retention** — keep access-log retention as short as operational needs allow; SSE tokens are short-lived but log retention may be longer.

Fly does not expose per-route query-param redaction in `fly.toml`; redaction happens in the log pipeline or by not logging sensitive URLs at the app layer.

## Cloudflare (web + marketing Workers)

Cloudflare Workers HTTP logs and Logpush payloads may include the full URL for client-initiated requests.

1. **Workers Trace Events / Logpush** — configure a Logpush job filter or post-processing step to redact `token=` from the `ClientRequestURI` / URL fields before long-term storage.
2. **Avoid logging full URLs in Worker code** — log pathname + `requestId` only when adding custom `console.log` output.
3. **Analytics** — Umami on marketing pages does not receive SSE tokens; no change required for marketing analytics (Decision #15).

## Verification

After configuring log shipping:

1. Trigger an SSE connection in staging.
2. Inspect a sample access-log line for the stream endpoint.
3. Confirm `token=` appears as redacted or is absent; path and status code remain visible.

## Related

- Sentry scrubber: `packages/utils/src/sentry/scrub-sentry-event.ts`
- Security baseline logging list: `.cursor/rules/03-security-baseline.mdc`
- PRD §9 Observability — Sentry
