import type { WorkspacePlan } from "./workspace.js";

export type BillingUsageMetric = {
  used: number;
  limit: number | null;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  hosted_invoice_url: string | null;
};

/** Workspace billing summary (PRD §24 — cloud only). */
export type WorkspaceBillingSummary = {
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

export type BillingCheckoutInput = {
  plan: "pro" | "business";
};

export type BillingSessionUrl = {
  url: string;
};
