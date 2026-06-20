"use client";

import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { WorkspacePlan } from "@pipewatch/types";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pipewatch/ui";

import {
  BillingPlanCard,
  BillingPlanOptions,
} from "@/components/billing/BillingPlanCard";
import { RetentionUsageRow, UsageMeter } from "@/components/billing/UsageMeter";
import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import { PLAN_ORDER } from "@/i18n/billing-formatters";
import { useBillingFormatters } from "@/i18n/use-billing-formatters";
import { ApiClientError } from "@/lib/api-client";
import { useToast } from "@/providers/ToastProvider";

type BillingUsageMetric = {
  used: number;
  limit: number | null;
};

type BillingInvoice = {
  id: string;
  number: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  hosted_invoice_url: string | null;
};

type WorkspaceBillingSummary = {
  plan: WorkspacePlan;
  usage: {
    repositories: BillingUsageMetric;
    members: BillingUsageMetric;
    retention_days: number;
  };
  subscription_status: string | null;
  next_billing_date: string | null;
  invoices: BillingInvoice[];
};

function invoiceStatusVariant(
  status: string,
): "success" | "default" | "failure" | "outline" {
  if (status === "paid") {
    return "success";
  }

  if (status === "open" || status === "draft") {
    return "outline";
  }

  if (status === "uncollectible" || status === "void") {
    return "failure";
  }

  return "default";
}

/** Workspace billing settings — plan, usage, checkout, portal, invoices (B12). */
export default function WorkspaceBillingSettingsPage() {
  const { workspace } = useApi();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const planOptionsRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("billing");
  const {
    formatBillingDate,
    formatCurrency,
    formatInvoicePeriod,
    formatInvoiceStatus,
    planLabel,
  } = useBillingFormatters();

  const [summary, setSummary] = useState<WorkspaceBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<WorkspacePlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!workspace) {
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const data = await workspace.get<WorkspaceBillingSummary>("/billing");
      setSummary(data);
    } catch {
      setLoadError(true);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");

    if (checkout === "success") {
      toast({
        title: t("toast.subscriptionUpdatedTitle"),
        description: t("toast.subscriptionUpdatedDescription"),
        variant: "success",
      });
    } else if (checkout === "cancelled") {
      toast({
        title: t("toast.checkoutCancelledTitle"),
        description: t("toast.checkoutCancelledDescription"),
        variant: "default",
      });
    }
  }, [searchParams, t, toast]);

  const openPortal = useCallback(async () => {
    if (!workspace) {
      return;
    }

    setPortalLoading(true);

    try {
      const { url } = await workspace.post<{ url: string }>("/billing/portal");
      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : t("toast.genericErrorDescription");
      toast({
        title: t("toast.portalUnavailableTitle"),
        description: message,
        variant: "error",
      });
    } finally {
      setPortalLoading(false);
    }
  }, [t, toast, workspace]);

  const startCheckout = useCallback(
    async (plan: WorkspacePlan) => {
      if (!workspace) {
        return;
      }

      setLoadingPlan(plan);

      try {
        const { url } = await workspace.post<{ url: string }>("/billing/checkout", { plan });
        window.location.assign(url);
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : t("toast.genericErrorDescription");
        toast({ title: t("toast.checkoutFailedTitle"), description: message, variant: "error" });
      } finally {
        setLoadingPlan(null);
      }
    },
    [t, toast, workspace],
  );

  const handleSelectPlan = useCallback(
    (targetPlan: WorkspacePlan) => {
      if (!summary) {
        return;
      }

      const currentRank = PLAN_ORDER[summary.plan];
      const targetRank = PLAN_ORDER[targetPlan];

      if (targetRank > currentRank) {
        if (targetPlan === "pro" || targetPlan === "business") {
          void startCheckout(targetPlan);
        }
        return;
      }

      if (targetRank < currentRank) {
        void openPortal();
      }
    },
    [openPortal, startCheckout, summary],
  );

  const scrollToPlanOptions = useCallback(() => {
    planOptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 760 }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>{t("subtitle")}</p>
        </header>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div style={{ maxWidth: 760 }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        </header>
        <ErrorRetry
          message={t("loadError")}
          onRetry={() => {
            void loadBilling();
          }}
        />
      </div>
    );
  }

  const planLimits = getPlanLimits(summary.plan);
  const billingDateLabel = formatBillingDate(summary.next_billing_date);

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 14 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 0 }}>
          {t("subtitle")}
        </p>
      </header>

      <BillingPlanCard
        plan={summary.plan}
        subscriptionStatus={summary.subscription_status}
        nextBillingDate={summary.next_billing_date}
        onChangePlan={scrollToPlanOptions}
        onCancel={() => {
          void openPortal();
        }}
        portalLoading={portalLoading}
      />

      <Card title={t("usage.title")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <UsageMeter
            label={t("usage.repositories")}
            used={summary.usage.repositories.used}
            limit={summary.usage.repositories.limit}
          />
          <UsageMeter
            label={t("usage.members")}
            used={summary.usage.members.used}
            limit={summary.usage.members.limit}
          />
          <RetentionUsageRow
            retentionDays={summary.usage.retention_days}
            maxRetentionDays={planLimits.maxRetentionDays}
            planLabel={planLabel(summary.plan)}
          />
        </div>

        {billingDateLabel ? (
          <p
            style={{
              margin: "18px 0 0",
              paddingTop: 14,
              borderTop: "1px solid var(--border-subtle)",
              fontSize: 12,
              color: "var(--text-tertiary)",
            }}
          >
            {t("usage.limitsReset", { date: billingDateLabel })}
          </p>
        ) : null}

        <div
          ref={planOptionsRef}
          style={{
            marginTop: 18,
            paddingTop: 18,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <BillingPlanOptions
            currentPlan={summary.plan}
            onSelectPlan={handleSelectPlan}
            loadingPlan={loadingPlan}
          />
        </div>
      </Card>

      <Card title={t("invoices.title")}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 20,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
              {t("invoices.paymentMethod")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
              {t("invoices.paymentMethodHint")}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={portalLoading}
            onClick={() => {
              void openPortal();
            }}
          >
            {t("invoices.updatePaymentMethod")}
          </Button>
        </div>

        {summary.invoices.length === 0 ? (
          <EmptyState
            title={t("invoices.emptyTitle")}
            description={t("invoices.emptyDescription")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoices.columns.period")}</TableHead>
                <TableHead align="right">{t("invoices.columns.amount")}</TableHead>
                <TableHead>{t("invoices.columns.status")}</TableHead>
                <TableHead align="right">{t("invoices.columns.invoice")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatInvoicePeriod(invoice.created_at)}</TableCell>
                  <TableCell align="right" mono>
                    {formatCurrency(invoice.amount_cents, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant(invoice.status)} pill>
                      {formatInvoiceStatus(invoice.status)}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    {invoice.hosted_invoice_url ? (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                        }}
                      >
                        {t("invoices.viewInvoice")}
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        {t("invoices.noLink")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {summary.invoices.length > 0 ? (
          <div style={{ paddingTop: 12, textAlign: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              loading={portalLoading}
              onClick={() => {
                void openPortal();
              }}
            >
              {t("invoices.viewAllInStripe")}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
