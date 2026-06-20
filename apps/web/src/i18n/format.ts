import type { AppLocale } from "./config";
import { defaultLocale } from "./config";

export function formatDateTime(
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
  locale: AppLocale = defaultLocale,
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: AppLocale = defaultLocale,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
  locale: AppLocale = defaultLocale,
): string {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}
