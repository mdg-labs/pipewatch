import { eq, or } from "drizzle-orm";
import type Stripe from "stripe";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { workspaces } from "@pipewatch/db/schema";
import type { WorkspacePlan } from "@pipewatch/types";

export type StripeWebhookEnv = Pick<ApiEnv, "STRIPE_PRICE_PRO" | "STRIPE_PRICE_BUSINESS">;

export const SUPPORTED_STRIPE_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
]);

function parseWorkspacePlan(plan: string | undefined): WorkspacePlan | null {
  if (plan === "pro" || plan === "business") {
    return plan;
  }

  return null;
}

function resolveCustomerId(customer: Stripe.Subscription["customer"]): string | null {
  if (typeof customer === "string") {
    return customer;
  }

  return customer?.id ?? null;
}

function resolveSubscriptionPriceId(subscription: Stripe.Subscription): string | undefined {
  return subscription.items.data[0]?.price?.id;
}

export function resolvePlanFromPriceId(
  priceId: string | undefined,
  env: StripeWebhookEnv,
): WorkspacePlan | null {
  if (!priceId) {
    return null;
  }

  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) {
    return "pro";
  }

  if (env.STRIPE_PRICE_BUSINESS && priceId === env.STRIPE_PRICE_BUSINESS) {
    return "business";
  }

  return null;
}

async function findWorkspaceById(database: Db, workspaceId: string) {
  const [workspace] = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return workspace ?? null;
}

async function findWorkspaceForSubscription(database: Db, subscription: Stripe.Subscription) {
  const customerId = resolveCustomerId(subscription.customer);
  const workspaceId = subscription.metadata.workspace_id;

  if (workspaceId) {
    const workspace = await findWorkspaceById(database, workspaceId);
    if (workspace) {
      return workspace;
    }
  }

  if (customerId) {
    const [workspace] = await database
      .select()
      .from(workspaces)
      .where(eq(workspaces.stripeCustomerId, customerId))
      .limit(1);

    if (workspace) {
      return workspace;
    }
  }

  const [workspace] = await database
    .select()
    .from(workspaces)
    .where(eq(workspaces.stripeSubscriptionId, subscription.id))
    .limit(1);

  return workspace ?? null;
}

async function syncSubscriptionPlan(
  database: Db,
  env: StripeWebhookEnv,
  subscription: Stripe.Subscription,
): Promise<void> {
  const workspace = await findWorkspaceForSubscription(database, subscription);
  if (!workspace) {
    return;
  }

  const plan = resolvePlanFromPriceId(resolveSubscriptionPriceId(subscription), env);
  const customerId = resolveCustomerId(subscription.customer);

  await database
    .update(workspaces)
    .set({
      ...(plan ? { plan } : {}),
      stripeSubscriptionId: subscription.id,
      ...(customerId && !workspace.stripeCustomerId ? { stripeCustomerId: customerId } : {}),
    })
    .where(eq(workspaces.id, workspace.id));
}

async function handleSubscriptionDeleted(
  database: Db,
  subscription: Stripe.Subscription,
): Promise<void> {
  const workspace = await findWorkspaceForSubscription(database, subscription);
  if (!workspace) {
    return;
  }

  await database
    .update(workspaces)
    .set({
      plan: "free",
      stripeSubscriptionId: null,
    })
    .where(eq(workspaces.id, workspace.id));
}

async function handleCheckoutSessionCompleted(
  database: Db,
  env: StripeWebhookEnv,
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") {
    return;
  }

  const workspaceId = session.metadata?.workspace_id;
  if (!workspaceId) {
    return;
  }

  const workspace = await findWorkspaceById(database, workspaceId);
  if (!workspace) {
    return;
  }

  const metadataPlan = parseWorkspacePlan(session.metadata?.target_plan);
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  let plan = metadataPlan;
  if (!plan && subscriptionId) {
    const lineItemPriceId = session.line_items?.data[0]?.price?.id;
    plan = resolvePlanFromPriceId(lineItemPriceId, env);
  }

  if (!plan) {
    return;
  }

  await database
    .update(workspaces)
    .set({
      plan,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    })
    .where(eq(workspaces.id, workspace.id));
}

/** Apply a verified Stripe webhook event to workspace billing state (PRD §24). */
export async function handleStripeWebhookEvent(
  database: Db,
  env: StripeWebhookEnv,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscriptionPlan(database, env, event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(database, event.data.object);
      break;
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(database, env, event.data.object);
      break;
    default:
      break;
  }
}

/** Find workspace rows that would match a subscription event (test helper). */
export async function findWorkspaceForStripeCustomerOrSubscription(
  database: Db,
  customerId: string | null,
  subscriptionId: string | null,
) {
  const predicates = [];
  if (customerId) {
    predicates.push(eq(workspaces.stripeCustomerId, customerId));
  }
  if (subscriptionId) {
    predicates.push(eq(workspaces.stripeSubscriptionId, subscriptionId));
  }

  if (predicates.length === 0) {
    return null;
  }

  const [workspace] = await database
    .select()
    .from(workspaces)
    .where(predicates.length === 1 ? predicates[0] : or(...predicates))
    .limit(1);

  return workspace ?? null;
}
