"use client";

import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { WorkspacePlan } from "@pipewatch/types";
import { useTranslations } from "next-intl";

import { Badge, Button, Card } from "@pipewatch/ui";

import {
  PLAN_ORDER,
  PLAN_PRICES,
} from "@/i18n/billing-formatters";
import { useBillingFormatters } from "@/i18n/use-billing-formatters";

export type BillingPlanCardProps = {
  plan: WorkspacePlan;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  onChangePlan: () => void;
  onCancel: () => void;
  portalLoading?: boolean;
};

function isActiveSubscription(status: string | null): boolean {
  return status === "active" || status === "trialing";
}

/** Current plan summary — name, price, billing date, portal actions (B12). */
export function BillingPlanCard({
  plan,
  subscriptionStatus,
  nextBillingDate,
  onChangePlan,
  onCancel,
  portalLoading = false,
}: BillingPlanCardProps) {
  const t = useTranslations("billing.planCard");
  const {
    formatBillingDate,
    formatPlanPrice,
    formatSubscriptionStatus,
    planLabel,
  } = useBillingFormatters();

  const price = PLAN_PRICES[plan];
  const billingDate = formatBillingDate(nextBillingDate);
  const paidPlan = plan !== "free";

  return (
    <Card title={t("title")}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {planLabel(plan)}
            </span>
            <Badge variant="accent" pill>
              {t("currentBadge")}
            </Badge>
            {subscriptionStatus ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: isActiveSubscription(subscriptionStatus)
                    ? "var(--status-success)"
                    : "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "9999px",
                    background: isActiveSubscription(subscriptionStatus)
                      ? "var(--status-success)"
                      : "var(--text-tertiary)",
                  }}
                  aria-hidden
                />
                {formatSubscriptionStatus(subscriptionStatus)}
              </span>
            ) : null}
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              fontWeight: 600,
              fontFeatureSettings: "'tnum'",
            }}
          >
            {formatPlanPrice(price)}{" "}
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>
              {t("perMonth")}
            </span>
          </div>

          {billingDate ? (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
              {t("nextBillingDate", { date: billingDate })}
            </p>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" onClick={onChangePlan}>
            {t("changePlan")}
          </Button>
          {paidPlan ? (
            <Button
              variant="ghost"
              size="sm"
              loading={portalLoading}
              onClick={onCancel}
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("cancelSubscription")}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export type BillingPlanOptionsProps = {
  currentPlan: WorkspacePlan;
  onSelectPlan: (plan: WorkspacePlan) => void;
  loadingPlan: WorkspacePlan | null;
};

/** Plan comparison cards with upgrade/downgrade CTAs (B12). */
export function BillingPlanOptions({
  currentPlan,
  onSelectPlan,
  loadingPlan,
}: BillingPlanOptionsProps) {
  const t = useTranslations("billing.planOptions");
  const tCard = useTranslations("billing.planCard");
  const {
    formatPlanLimit,
    formatPlanPrice,
    formatRetentionLimit,
    planLabel,
  } = useBillingFormatters();
  const plans: WorkspacePlan[] = ["free", "pro", "business"];

  return (
    <div>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-secondary)",
        }}
      >
        {t("comparisonTitle")}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {plans.map((plan) => {
          const limits = getPlanLimits(plan);
          const isCurrent = plan === currentPlan;
          const planRank = PLAN_ORDER[plan];
          const currentRank = PLAN_ORDER[currentPlan];
          const isUpgrade = planRank > currentRank;
          const isDowngrade = planRank < currentRank;
          const price = PLAN_PRICES[plan];

          let actionLabel = t("currentPlan");
          if (isUpgrade) {
            actionLabel = t("upgrade");
          } else if (isDowngrade) {
            actionLabel = t("downgrade");
          }

          return (
            <div
              key={plan}
              style={{
                background: isCurrent
                  ? "oklch(70% 0.195 55 / 0.04)"
                  : "var(--bg-elevated)",
                border: isCurrent
                  ? "1.5px solid var(--border-accent)"
                  : "1px solid var(--border-default)",
                borderRadius: 7,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{planLabel(plan)}</span>
                {isCurrent ? (
                  <Badge variant="accent" pill>
                    {t("currentBadge")}
                  </Badge>
                ) : null}
              </div>

              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 18,
                  fontWeight: 700,
                  fontFeatureSettings: "'tnum'",
                  marginBottom: 12,
                  letterSpacing: "-0.02em",
                  color: isCurrent ? "var(--text-accent)" : "var(--text-primary)",
                }}
              >
                {formatPlanPrice(price)}{" "}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>
                  {tCard("perMonthShort")}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginBottom: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <div>{formatPlanLimit(limits.repoLimit, "repositories")}</div>
                <div>{formatPlanLimit(limits.memberLimit, "members")}</div>
                <div>{formatRetentionLimit(limits.maxRetentionDays)}</div>
              </div>

              <Button
                variant={isUpgrade ? "primary" : "secondary"}
                size="sm"
                disabled={isCurrent}
                loading={loadingPlan === plan}
                onClick={() => {
                  onSelectPlan(plan);
                }}
                style={{ width: "100%" }}
              >
                {actionLabel}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
