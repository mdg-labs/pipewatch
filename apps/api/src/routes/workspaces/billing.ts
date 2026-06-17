import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { flags } from "@pipewatch/config/edition";
import type { Db } from "@pipewatch/db";

import { getWorkspaceContext, roleMeetsMinimum } from "../../lib/workspace-context.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import {
  BillingError,
  createCheckoutSession,
  createPortalSession,
  createStripeClient,
  getWorkspaceBillingSummary,
  type BillingEnv,
  type StripeCheckoutClient,
} from "../../services/stripe-checkout.js";
import type { ApiEnv as AppApiEnv } from "../../types.js";

const WorkspacePlanSchema = z.enum(["free", "pro", "business"]);

const UsageMetricSchema = z
  .object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive().nullable(),
  })
  .openapi("BillingUsageMetric");

const BillingInvoiceSchema = z
  .object({
    id: z.string(),
    number: z.string().nullable(),
    status: z.string(),
    amount_cents: z.number().int(),
    currency: z.string(),
    created_at: z.string().datetime(),
    hosted_invoice_url: z.string().url().nullable(),
  })
  .openapi("BillingInvoice");

const BillingSummarySchema = z
  .object({
    plan: WorkspacePlanSchema,
    usage: z.object({
      repositories: UsageMetricSchema,
      members: UsageMetricSchema,
      retention_days: z.number().int().positive(),
    }),
    subscription_status: z.string().nullable(),
    next_billing_date: z.string().datetime().nullable(),
    invoices: z.array(BillingInvoiceSchema),
  })
  .openapi("WorkspaceBillingSummary");

const CheckoutBodySchema = z
  .object({
    plan: z.enum(["pro", "business"]).openapi({ example: "pro" }),
  })
  .openapi("BillingCheckoutBody");

const SessionUrlSchema = z
  .object({
    url: z.string().url(),
  })
  .openapi("BillingSessionUrl");

const workspaceParams = z.object({
  workspaceId: z.string().uuid(),
});

const getBillingRoute = createRoute({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/billing",
  tags: ["Billing"],
  summary: "Get workspace billing summary",
  description:
    "Returns plan, usage, next billing date, and recent invoices. Cloud only; owner-only.",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceParams,
  },
  responses: {
    200: {
      description: "Billing summary",
      content: {
        "application/json": {
          schema: BillingSummarySchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const checkoutRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/billing/checkout",
  tags: ["Billing"],
  summary: "Create Stripe Checkout session",
  description:
    "Starts a subscription checkout for Pro or Business. Cloud only; owner-only.",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CheckoutBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Checkout session URL",
      content: {
        "application/json": {
          schema: SessionUrlSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    422: {
      description: "Request validation failed",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

const portalRoute = createRoute({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/billing/portal",
  tags: ["Billing"],
  summary: "Create Stripe Customer Portal session",
  description:
    "Opens the billing portal for payment method updates and subscription cancellation. Cloud only; owner-only.",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceParams,
  },
  responses: {
    200: {
      description: "Customer portal session URL",
      content: {
        "application/json": {
          schema: SessionUrlSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    403: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

export type BillingRoutesDependencies = {
  env: BillingEnv;
  db: Db;
  stripe?: StripeCheckoutClient;
};

function handleBillingServiceError(error: unknown): never {
  if (error instanceof BillingError) {
    throw new HTTPException(error.status as 404 | 422 | 500, {
      message: error.message,
    });
  }

  throw error;
}

function requireOwnerContext(c: Parameters<typeof getWorkspaceContext>[0]) {
  if (!flags.STRIPE_ENABLED) {
    return { error: apiError("NOT_FOUND", "Not found"), status: 404 as const };
  }

  const context = getWorkspaceContext(c);

  if (!context) {
    return { error: apiError("UNAUTHORIZED", "Authentication required"), status: 401 as const };
  }

  if (!roleMeetsMinimum(context.role, "owner")) {
    return {
      error: apiError("FORBIDDEN", "Insufficient workspace permissions"),
      status: 403 as const,
    };
  }

  return { context };
}

function resolveStripe(deps: BillingRoutesDependencies): StripeCheckoutClient {
  if (deps.stripe) {
    return deps.stripe;
  }

  return createStripeClient(deps.env);
}

/** Register workspace billing routes (PRD §24, page B12). */
export function registerBillingRoutes(
  app: OpenAPIHono<AppApiEnv>,
  deps: BillingRoutesDependencies,
): void {
  app.openapi(getBillingRoute, async (c) => {
    const auth = requireOwnerContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const summary = await getWorkspaceBillingSummary(
        deps.db,
        resolveStripe(deps),
        workspaceId,
      );
      return c.json(summary, 200);
    } catch (error) {
      handleBillingServiceError(error);
    }
  });

  app.openapi(checkoutRoute, async (c) => {
    const auth = requireOwnerContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");
    const body = c.req.valid("json");

    try {
      const session = await createCheckoutSession(
        deps.db,
        resolveStripe(deps),
        deps.env,
        workspaceId,
        body.plan,
      );
      return c.json(session, 200);
    } catch (error) {
      handleBillingServiceError(error);
    }
  });

  app.openapi(portalRoute, async (c) => {
    const auth = requireOwnerContext(c);
    if ("error" in auth) {
      return c.json(auth.error, auth.status);
    }

    const workspaceId = c.req.param("workspaceId");

    try {
      const session = await createPortalSession(
        deps.db,
        resolveStripe(deps),
        deps.env,
        workspaceId,
      );
      return c.json(session, 200);
    } catch (error) {
      handleBillingServiceError(error);
    }
  });
}
