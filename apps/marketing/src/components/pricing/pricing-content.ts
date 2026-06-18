export type PlanId = "free" | "pro" | "business";

export type ComparisonCell =
  | { kind: "check" }
  | { kind: "dash" }
  | { kind: "text"; value: string }
  | { kind: "soon" };

export interface PricingPlan {
  id: PlanId;
  name: string;
  monthlyPrice: string;
  period: string;
  highlight: boolean;
  badge?: string;
  summary: string;
  features: readonly string[];
  ctaLabel: string;
}

export interface ComparisonRow {
  id: string;
  feature: string;
  free: ComparisonCell;
  pro: ComparisonCell;
  business: ComparisonCell;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const pricingPlans: readonly PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    period: "forever",
    highlight: false,
    summary: "1 workspace · 10 repos · 30-day retention",
    features: [
      "Live pipeline view",
      "Basic insights",
      "API access + API keys",
      "1 team member (owner)",
    ],
    ctaLabel: "Get started free",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$19",
    period: "/mo",
    highlight: true,
    badge: "Most popular",
    summary: "3 workspaces · 50 repos · 365-day retention",
    features: [
      "Everything in Free",
      "Advanced analytics",
      "Up to 5 team members",
      "Webhook Gateway (soon)",
      "Alerts & notifications (soon)",
    ],
    ctaLabel: "Start with Pro",
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: "$49",
    period: "/mo",
    highlight: false,
    summary: "Unlimited workspaces · repos · members",
    features: [
      "Everything in Pro",
      "Priority support",
      "Unlimited team members",
      "SSO (soon)",
    ],
    ctaLabel: "Start with Business",
  },
] as const;

export const comparisonRows: readonly ComparisonRow[] = [
  {
    id: "workspaces",
    feature: "Workspaces",
    free: { kind: "text", value: "1" },
    pro: { kind: "text", value: "3" },
    business: { kind: "text", value: "Unlimited" },
  },
  {
    id: "repositories",
    feature: "Repositories",
    free: { kind: "text", value: "Up to 10" },
    pro: { kind: "text", value: "Up to 50" },
    business: { kind: "text", value: "Unlimited" },
  },
  {
    id: "retention",
    feature: "Run history retention",
    free: { kind: "text", value: "30 days (fixed)" },
    pro: { kind: "text", value: "Up to 365 days" },
    business: { kind: "text", value: "Up to 365 days" },
  },
  {
    id: "members",
    feature: "Team members",
    free: { kind: "text", value: "1 (owner only)" },
    pro: { kind: "text", value: "Up to 5" },
    business: { kind: "text", value: "Unlimited" },
  },
  {
    id: "live-pipeline",
    feature: "Live pipeline view",
    free: { kind: "check" },
    pro: { kind: "check" },
    business: { kind: "check" },
  },
  {
    id: "basic-insights",
    feature: "Basic insights",
    free: { kind: "check" },
    pro: { kind: "check" },
    business: { kind: "check" },
  },
  {
    id: "advanced-analytics",
    feature: "Advanced analytics",
    free: { kind: "dash" },
    pro: { kind: "check" },
    business: { kind: "check" },
  },
  {
    id: "api-access",
    feature: "API access + API keys",
    free: { kind: "check" },
    pro: { kind: "check" },
    business: { kind: "check" },
  },
  {
    id: "webhook-gateway",
    feature: "Webhook Gateway",
    free: { kind: "dash" },
    pro: { kind: "soon" },
    business: { kind: "soon" },
  },
  {
    id: "alerts",
    feature: "Alerts & notifications",
    free: { kind: "dash" },
    pro: { kind: "soon" },
    business: { kind: "soon" },
  },
  {
    id: "priority-support",
    feature: "Priority support",
    free: { kind: "dash" },
    pro: { kind: "dash" },
    business: { kind: "check" },
  },
  {
    id: "sso",
    feature: "SSO",
    free: { kind: "dash" },
    pro: { kind: "dash" },
    business: { kind: "soon" },
  },
] as const;

export const pricingFaqItems: readonly FaqItem[] = [
  {
    id: "repo-count",
    question: "What counts as a repo?",
    answer:
      "Each GitHub repository you connect to PipeWatch counts toward your plan limit. Archived repos you disconnect no longer count. Monorepo subfolders do not count separately — one GitHub repo is one PipeWatch repo.",
  },
  {
    id: "repo-limit",
    question: "What happens at the repo limit?",
    answer:
      "You cannot connect additional repositories until you upgrade or remove an existing connection. Existing repos keep syncing and your dashboard stays fully usable.",
  },
  {
    id: "self-host",
    question: "Can I self-host for free?",
    answer:
      "Yes. PipeWatch CE is open source and free to self-host with Docker Compose. All features are included — no licence key required. Your data stays on your infrastructure.",
  },
  {
    id: "switch-plans",
    question: "Can I switch plans?",
    answer:
      "Yes. Upgrade or downgrade anytime from workspace billing settings. Upgrades take effect immediately; downgrades apply at the end of your current billing period.",
  },
  {
    id: "refunds",
    question: "Refunds?",
    answer:
      "We offer a 14-day money-back guarantee on paid plans. Contact support within 14 days of your first charge for a full refund — no questions asked.",
  },
] as const;
