import { and, count, eq, isNotNull } from "drizzle-orm";
import Stripe from "stripe";

import type { ApiEnv } from "@pipewatch/config/env";
import { PLAN_LIMITS } from "@pipewatch/config/plan-limits";
import type { Db } from "@pipewatch/db";
import { users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import type { WorkspacePlan } from "@pipewatch/types";

import { countWorkspaceEnabledRepositories } from "./repositories/repository.service.js";

export type BillingEnv = Pick<
  ApiEnv,
  "STRIPE_SECRET_KEY" | "STRIPE_PRICE_PRO" | "STRIPE_PRICE_BUSINESS" | "APP_URL"
>;

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

export type StripeCheckoutClient = Pick<
  Stripe,
  "customers" | "checkout" | "billingPortal" | "subscriptions" | "invoices"
>;

export class BillingError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "BillingError";
    this.status = status;
    this.code = code;
  }
}

function parseWorkspacePlan(plan: string): WorkspacePlan {
  if (plan === "pro" || plan === "business") {
    return plan;
  }

  return "free";
}

function resolvePriceId(env: BillingEnv, plan: WorkspacePlan): string {
  if (plan === "pro") {
    if (!env.STRIPE_PRICE_PRO) {
      throw new BillingError("Pro plan price is not configured", 500, "INTERNAL_ERROR");
    }

    return env.STRIPE_PRICE_PRO;
  }

  if (plan === "business") {
    if (!env.STRIPE_PRICE_BUSINESS) {
      throw new BillingError("Business plan price is not configured", 500, "INTERNAL_ERROR");
    }

    return env.STRIPE_PRICE_BUSINESS;
  }

  throw new BillingError("Checkout is only available for paid plans", 422, "VALIDATION_ERROR");
}

export function buildWorkspaceBillingPageUrl(env: BillingEnv, workspaceSlug: string): string {
  if (!env.APP_URL) {
    throw new BillingError("APP_URL is not configured", 500, "INTERNAL_ERROR");
  }

  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/workspaces/${workspaceSlug}/settings/billing`;
}

export function createStripeClient(env: BillingEnv): StripeCheckoutClient {
  if (!env.STRIPE_SECRET_KEY) {
    throw new BillingError("Stripe is not configured", 500, "INTERNAL_ERROR");
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: Stripe.API_VERSION,
  });
}

async function loadWorkspaceRow(database: Db, workspaceId: string) {
  const [workspace] = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new BillingError("Workspace not found", 404, "NOT_FOUND");
  }

  return workspace;
}

async function loadWorkspaceOwnerEmail(
  database: Db,
  workspaceId: string,
): Promise<string | undefined> {
  const [row] = await database
    .select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    )
    .limit(1);

  return row?.email ?? undefined;
}

async function countAcceptedMembers(database: Db, workspaceId: string): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), isNotNull(workspaceMembers.acceptedAt)),
    );

  return row?.total ?? 0;
}

function mapInvoice(invoice: Stripe.Invoice): BillingInvoice {
  if (!invoice.id) {
    throw new BillingError("Stripe invoice is missing an id", 500, "INTERNAL_ERROR");
  }

  return {
    id: invoice.id,
    number: invoice.number ?? null,
    status: invoice.status ?? "unknown",
    amount_cents: invoice.amount_due,
    currency: invoice.currency,
    created_at: new Date(invoice.created * 1000).toISOString(),
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
  };
}

export async function ensureStripeCustomer(
  database: Db,
  stripe: StripeCheckoutClient,
  workspaceId: string,
): Promise<string> {
  const workspace = await loadWorkspaceRow(database, workspaceId);

  if (workspace.stripeCustomerId) {
    return workspace.stripeCustomerId;
  }

  const ownerEmail = await loadWorkspaceOwnerEmail(database, workspaceId);

  const customer = await stripe.customers.create({
    ...(ownerEmail ? { email: ownerEmail } : {}),
    metadata: {
      workspace_id: workspaceId,
    },
  });

  await database
    .update(workspaces)
    .set({ stripeCustomerId: customer.id })
    .where(eq(workspaces.id, workspaceId));

  return customer.id;
}

export async function createCheckoutSession(
  database: Db,
  stripe: StripeCheckoutClient,
  env: BillingEnv,
  workspaceId: string,
  targetPlan: WorkspacePlan,
): Promise<{ url: string }> {
  if (targetPlan === "free") {
    throw new BillingError("Checkout is only available for paid plans", 422, "VALIDATION_ERROR");
  }

  const workspace = await loadWorkspaceRow(database, workspaceId);
  const customerId = await ensureStripeCustomer(database, stripe, workspaceId);
  const priceId = resolvePriceId(env, targetPlan);
  const billingPageUrl = buildWorkspaceBillingPageUrl(env, workspace.slug);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${billingPageUrl}?checkout=success`,
    cancel_url: `${billingPageUrl}?checkout=cancelled`,
    metadata: {
      workspace_id: workspaceId,
      target_plan: targetPlan,
    },
  });

  if (!session.url) {
    throw new BillingError("Stripe checkout session did not return a URL", 500, "INTERNAL_ERROR");
  }

  return { url: session.url };
}

export async function createPortalSession(
  database: Db,
  stripe: StripeCheckoutClient,
  env: BillingEnv,
  workspaceId: string,
): Promise<{ url: string }> {
  const workspace = await loadWorkspaceRow(database, workspaceId);
  const customerId = workspace.stripeCustomerId;

  if (!customerId) {
    throw new BillingError(
      "No billing account exists for this workspace",
      404,
      "NOT_FOUND",
    );
  }

  const billingPageUrl = buildWorkspaceBillingPageUrl(env, workspace.slug);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: billingPageUrl,
  });

  return { url: session.url };
}

export async function getWorkspaceBillingSummary(
  database: Db,
  stripe: StripeCheckoutClient,
  workspaceId: string,
): Promise<WorkspaceBillingSummary> {
  const workspace = await loadWorkspaceRow(database, workspaceId);
  const plan = parseWorkspacePlan(workspace.plan);

  const [repoUsed, memberUsed] = await Promise.all([
    countWorkspaceEnabledRepositories(database, workspaceId),
    countAcceptedMembers(database, workspaceId),
  ]);

  let subscriptionStatus: string | null = null;
  let nextBillingDate: string | null = null;
  let invoices: BillingInvoice[] = [];

  if (workspace.stripeCustomerId) {
    if (workspace.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId, {
        expand: ["items.data"],
      });
      subscriptionStatus = subscription.status;
      const firstItem = subscription.items.data[0];
      if (firstItem) {
        nextBillingDate = new Date(firstItem.current_period_end * 1000).toISOString();
      }
    }

    const invoiceList = await stripe.invoices.list({
      customer: workspace.stripeCustomerId,
      limit: 12,
    });

    invoices = invoiceList.data.map(mapInvoice);
  }

  return {
    plan,
    usage: {
      repositories: {
        used: repoUsed,
        limit: PLAN_LIMITS[plan].repoLimit,
      },
      members: {
        used: memberUsed,
        limit: PLAN_LIMITS[plan].memberLimit,
      },
      retention_days: Math.min(workspace.defaultRetentionDays, PLAN_LIMITS[plan].maxRetentionDays),
    },
    subscription_status: subscriptionStatus,
    next_billing_date: nextBillingDate,
    invoices,
  };
}
