"use client";

import { getPlanLimits } from "@pipewatch/config/plan-limits";
import type { WorkspacePlan } from "@pipewatch/types";

import { Badge, Button, Card } from "@pipewatch/ui";

export type BillingPlanCardProps = {
  plan: WorkspacePlan;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  onChangePlan: () => void;
  onCancel: () => void;
  portalLoading?: boolean;
};

const PLAN_LABELS: Record<WorkspacePlan, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const PLAN_PRICES: Record<WorkspacePlan, number> = {
  free: 0,
  pro: 19,
  business: 49,
};

const PLAN_ORDER: Record<WorkspacePlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

function formatBillingDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso));
}

function formatSubscriptionStatus(status: string | null): string {
  if (!status) {
    return "Free";
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

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
  const price = PLAN_PRICES[plan];
  const billingDate = formatBillingDate(nextBillingDate);
  const paidPlan = plan !== "free";

  return (
    <Card title="Current plan">
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
              {PLAN_LABELS[plan]}
            </span>
            <Badge variant="accent" pill>
              Current plan
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
            ${price}{" "}
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>
              / month
            </span>
          </div>

          {billingDate ? (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
              Next billing date:{" "}
              <span style={{ color: "var(--text-secondary)" }}>{billingDate}</span>
            </p>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" onClick={onChangePlan}>
            Change plan
          </Button>
          {paidPlan ? (
            <Button
              variant="ghost"
              size="sm"
              loading={portalLoading}
              onClick={onCancel}
              style={{ color: "var(--text-tertiary)" }}
            >
              Cancel subscription
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

function formatPlanLimit(value: number | null, singular: string): string {
  if (value === null) {
    return `Unlimited ${singular}`;
  }

  return `${String(value)} ${singular}`;
}

function formatRetentionLimit(days: number): string {
  return `${String(days)} day retention`;
}

/** Plan comparison cards with upgrade/downgrade CTAs (B12). */
export function BillingPlanOptions({
  currentPlan,
  onSelectPlan,
  loadingPlan,
}: BillingPlanOptionsProps) {
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
        Plan comparison
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

          let actionLabel = "Current plan";
          if (isUpgrade) {
            actionLabel = "Upgrade";
          } else if (isDowngrade) {
            actionLabel = "Downgrade";
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
                <span style={{ fontSize: 14, fontWeight: 600 }}>{PLAN_LABELS[plan]}</span>
                {isCurrent ? (
                  <Badge variant="accent" pill>
                    Current
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
                ${price}{" "}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>
                  /mo
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
