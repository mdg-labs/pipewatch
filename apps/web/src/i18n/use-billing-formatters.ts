"use client";

import type { WorkspacePlan } from "@pipewatch/types";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  formatBillingDate,
  formatCurrency,
  formatInvoicePeriod,
  formatInvoiceStatus,
  formatPlanLimit,
  formatPlanPrice,
  formatRetentionLimit,
  formatSubscriptionStatus,
} from "./billing-formatters";
import type { AppLocale } from "./config";
import { defaultLocale, isAppLocale } from "./config";

export function useBillingFormatters() {
  const localeRaw = useLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : defaultLocale;
  const t = useTranslations("billing");
  const tPlans = useTranslations("billing.planLabels");

  return useMemo(
    () => ({
      locale,
      formatBillingDate: (iso: string | null) => formatBillingDate(iso, locale),
      formatInvoicePeriod: (iso: string) => formatInvoicePeriod(iso, locale),
      formatCurrency: (amountCents: number, currency: string) =>
        formatCurrency(amountCents, currency, locale),
      formatPlanPrice: (amountUsd: number) => formatPlanPrice(amountUsd, locale),
      formatSubscriptionStatus: (status: string | null) =>
        formatSubscriptionStatus(status, t),
      formatInvoiceStatus: (status: string) => formatInvoiceStatus(status, t),
      formatPlanLimit: (value: number | null, singularKey: "repositories" | "members") =>
        formatPlanLimit(value, singularKey, t),
      formatRetentionLimit: (days: number) => formatRetentionLimit(days, t),
      planLabel: (plan: WorkspacePlan) => tPlans(plan),
    }),
    [locale, t, tPlans],
  );
}
