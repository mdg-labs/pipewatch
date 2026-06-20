type IntlErrorLike = {
  code: string;
  originalMessage?: string | undefined;
};

export function warnMissingMessage(error: IntlErrorLike): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const target = error.originalMessage ?? "unknown";

  // Dev-only missing-key signal for translators (acceptance #198).
  // eslint-disable-next-line no-console -- intentional i18n dev warning
  console.warn(`[i18n] Missing message: ${target}`);
}

export function missingMessageFallback({
  namespace,
  key,
}: {
  error: IntlErrorLike;
  key: string;
  namespace?: string | undefined;
}): string {
  return namespace ? `${namespace}.${key}` : key;
}
