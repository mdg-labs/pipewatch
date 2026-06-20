import type { WorkspacePlan } from "@pipewatch/types";

import type { AppLocale } from "./config";
import { defaultLocale } from "./config";
import { formatDateTime } from "./format";

export function formatBillingDate(
  iso: string | null,
  locale: AppLocale = defaultLocale,
): string | null {
  if (!iso) {
    return null;
  }

  return formatDateTime(new Date(iso), { dateStyle: "long" }, locale);
}

export function formatInvoicePeriod(iso: string, locale: AppLocale = defaultLocale): string {
  return formatDateTime(new Date(iso), { month: "long", year: "numeric" }, locale);
}

export function formatCurrency(
  amountCents: number,
  currency: string,
  locale: AppLocale = defaultLocale,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function formatPlanPrice(
  amountUsd: number,
  locale: AppLocale = defaultLocale,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountUsd);
}

type StatusTranslator = (key: string, values?: Record<string, string | number>) => string;

const SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "cancelled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);

const INVOICE_STATUSES = new Set(["paid", "open", "draft", "uncollectible", "void"]);

export function formatSubscriptionStatus(
  status: string | null,
  t: StatusTranslator,
): string {
  if (!status) {
    return t("free");
  }

  if (SUBSCRIPTION_STATUSES.has(status)) {
    return t(`status.${status}`);
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatInvoiceStatus(status: string, t: StatusTranslator): string {
  if (INVOICE_STATUSES.has(status)) {
    return t(`invoiceStatus.${status}`);
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPlanLimit(
  value: number | null,
  singularKey: "repositories" | "members",
  t: StatusTranslator,
): string {
  if (value === null) {
    return t(`limits.unlimited.${singularKey}`);
  }

  return t(`limits.count.${singularKey}`, { count: value });
}

export function formatRetentionLimit(days: number, t: StatusTranslator): string {
  return t("limits.retention", { days });
}

export const PLAN_PRICES: Record<WorkspacePlan, number> = {
  free: 0,
  pro: 19,
  business: 49,
};

export const PLAN_ORDER: Record<WorkspacePlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
};
