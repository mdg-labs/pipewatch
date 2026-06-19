/** Placeholder written by {@link scrubSentryEvent} for sensitive values. */
export const SENTRY_REDACTED = "[Redacted]";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
]);

const SENSITIVE_KEY_PATTERN =
  /(?:^|_)(token|password(?:hash)?|secret|api[_-]?key|refresh[_-]?token|access[_-]?token|private[_-]?key)(?:$|_)/i;

const BEARER_TOKEN_PATTERN = /Bearer\s+\S+/gi;
const API_KEY_PATTERN = /pw_[a-zA-Z0-9]+/g;
const TOKEN_QUERY_PARAM_PATTERN = /(^|[?&])token=[^&]*/gi;
const DATABASE_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"'<>]+/gi;

/** Minimal Sentry event shape — avoids coupling utils to @sentry/* SDK types. */
export type ScrubbableSentryEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string> | string;
    query_string?: string | Record<string, string>;
    url?: string;
    data?: string;
  };
  breadcrumbs?: Array<{ data?: Record<string, unknown>; message?: string }>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
};

function scrubString(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${SENTRY_REDACTED}`)
    .replace(API_KEY_PATTERN, SENTRY_REDACTED)
    .replace(TOKEN_QUERY_PARAM_PATTERN, `$1token=${SENTRY_REDACTED}`)
    .replace(DATABASE_URL_PATTERN, SENTRY_REDACTED);
}

function scrubUnknown(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key !== undefined && SENSITIVE_KEY_PATTERN.test(key)) {
      return SENTRY_REDACTED;
    }
    return scrubString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item));
  }

  if (value !== null && typeof value === "object") {
    return scrubRecord(value as Record<string, unknown>);
  }

  return value;
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      scrubbed[key] = SENTRY_REDACTED;
      continue;
    }

    scrubbed[key] = scrubUnknown(value, key);
  }

  return scrubbed;
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const scrubbed: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
      scrubbed[name] = SENTRY_REDACTED;
      continue;
    }

    scrubbed[name] = scrubString(value);
  }

  return scrubbed;
}

function scrubCookies(cookies: Record<string, string> | string): Record<string, string> | string {
  if (typeof cookies === "string") {
    return SENTRY_REDACTED;
  }

  const scrubbed: Record<string, string> = {};
  for (const [key, value] of Object.entries(cookies)) {
    scrubbed[key] = typeof value === "string" ? scrubString(value) : SENTRY_REDACTED;
  }
  return scrubbed;
}

/** Redact secrets from a Sentry event before it is sent upstream. */
export function scrubSentryEvent<T>(event: T): T {
  const scrubbable = event as ScrubbableSentryEvent;

  if (scrubbable.request?.headers) {
    scrubbable.request.headers = scrubHeaders(scrubbable.request.headers);
  }

  if (scrubbable.request?.cookies) {
    scrubbable.request.cookies = scrubCookies(scrubbable.request.cookies);
  }

  const queryString = scrubbable.request?.query_string;
  if (typeof queryString === "string") {
    scrubbable.request!.query_string = scrubString(queryString);
  } else if (queryString !== undefined) {
    scrubbable.request!.query_string = scrubRecord(
      queryString as Record<string, unknown>,
    ) as Record<string, string>;
  }

  if (typeof scrubbable.request?.url === "string") {
    scrubbable.request.url = scrubString(scrubbable.request.url);
  }

  if (typeof scrubbable.request?.data === "string") {
    scrubbable.request.data = scrubString(scrubbable.request.data);
  }

  if (scrubbable.breadcrumbs) {
    scrubbable.breadcrumbs = scrubbable.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.message ? { message: scrubString(crumb.message) } : {}),
      ...(crumb.data ? { data: scrubRecord(crumb.data) } : {}),
    }));
  }

  if (scrubbable.extra) {
    scrubbable.extra = scrubRecord(scrubbable.extra);
  }

  if (scrubbable.contexts) {
    scrubbable.contexts = scrubRecord(scrubbable.contexts);
  }

  return event;
}
