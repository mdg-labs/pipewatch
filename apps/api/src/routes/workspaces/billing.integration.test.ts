import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users, workspaceMembers, workspaces } from "@pipewatch/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { uniqueGithubId } from "../../testing/unique-github-id.js";
import { signAccessToken } from "../../services/auth/jwt.js";
import type {
  StripeCheckoutClient,
  WorkspaceBillingSummary,
} from "../../services/stripe-checkout.js";
import { registerWorkspaceRoutes } from "./index.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const testSecret = "a".repeat(32);

const editionMock = vi.hoisted(() => ({
  flags: {
    BILLING_ENABLED: true,
    PLAN_LIMITS_ENABLED: true,
    WAITLIST_ENABLED: true,
    NEWSLETTER_ENABLED: true,
    MULTI_WORKSPACE_ENABLED: true,
    BOOTSTRAP_ENABLED: false,
    UMAMI_ENABLED: true,
    STRIPE_ENABLED: true,
    API_KEYS_ENABLED: true,
    SSO_ENABLED: false,
    RETENTION_CEILING: true,
    IS_CE: false,
    IS_CLOUD: true,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  DATABASE_URL: "",
  APP_URL: "https://cloud.pipewatch.app",
  STRIPE_SECRET_KEY: "sk_test_mock",
  STRIPE_PRICE_PRO: "price_pro_test",
  STRIPE_PRICE_BUSINESS: "price_business_test",
};

type SeedUser = {
  id: string;
  email: string;
};

async function seedUser(database: Db, loginPrefix: string): Promise<SeedUser> {
  const suffix = randomBytes(4).toString("hex");
  const email = `${loginPrefix}-${suffix}@example.com`;

  const [user] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `${loginPrefix}-${suffix}`,
      email,
      name: "Billing User",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return { id: user.id, email };
}

type SeedWorkspace = {
  id: string;
  slug: string;
};

async function seedWorkspace(
  database: Db,
  slugPrefix: string,
  options?: {
    plan?: "free" | "pro" | "business";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  },
): Promise<SeedWorkspace> {
  const suffix = randomBytes(4).toString("hex");
  const slug = `${slugPrefix}-${suffix}`;

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Billing Workspace",
      slug,
      plan: options?.plan ?? "free",
      stripeCustomerId: options?.stripeCustomerId,
      stripeSubscriptionId: options?.stripeSubscriptionId,
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  return { id: workspace.id, slug };
}

async function addMember(
  database: Db,
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member",
): Promise<void> {
  await database.insert(workspaceMembers).values({
    workspaceId,
    userId,
    role,
    acceptedAt: new Date(),
  });
}

async function bearerToken(
  userId: string,
  workspaceId: string,
  role: "owner" | "admin" | "member",
): Promise<string> {
  return signAccessToken({ userId, workspaceId, role }, testSecret);
}

function createMockStripe(): StripeCheckoutClient {
  return {
    customers: {
      create: vi.fn(async () => ({ id: "cus_test_123" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (params: { success_url?: string; cancel_url?: string }) => ({
          url: `https://checkout.stripe.test/session?success=${encodeURIComponent(params.success_url ?? "")}`,
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async (params: { return_url?: string }) => ({
          url: `https://billing.stripe.test/portal?return=${encodeURIComponent(params.return_url ?? "")}`,
        })),
      },
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        status: "active",
        items: {
          data: [
            {
              current_period_end: Math.floor(Date.parse("2026-07-01T00:00:00.000Z") / 1000),
            },
          ],
        },
      })),
    },
    invoices: {
      list: vi.fn(async () => ({
        data: [
          {
            id: "in_test_1",
            number: "PW-1001",
            status: "paid",
            amount_due: 1900,
            currency: "usd",
            created: Math.floor(Date.parse("2026-06-01T00:00:00.000Z") / 1000),
            hosted_invoice_url: "https://invoice.stripe.test/in_test_1",
          },
        ],
      })),
    },
  } as unknown as StripeCheckoutClient;
}

function createTestApp(database: Db, stripe: StripeCheckoutClient) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "cloud",
  );

  registerWorkspaceRoutes(app, { env, db: database, stripe });

  return app;
}

let containerId = "";
let database: Db;
let mockStripe: StripeCheckoutClient;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(databaseUrl: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = createDb(databaseUrl);
      await probe.execute(sql`select 1`);
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Postgres container did not become ready in time");
}

beforeAll(async () => {
  const port = 55000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      `${String(port)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || "Failed to start Postgres container");
  }

  containerId = run.stdout.trim();
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${String(port)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;
  baseEnv.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  database = createDb(databaseUrl);
  mockStripe = createMockStripe();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  if (database) {
    await closeDb();
  }

  if (containerId) {
    spawnSync("docker", ["stop", containerId], { encoding: "utf8" });
  }
});

describe("workspace billing routes", () => {
  it("returns billing summary for workspace owner", async () => {
    const app = createTestApp(database, mockStripe);
    const owner = await seedUser(database, "billing-owner");
    const workspace = await seedWorkspace(database, "billing-ws", {
      plan: "pro",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
    });
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(`/api/v1/workspaces/${workspace.id}/billing`, {
      headers: {
        Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as WorkspaceBillingSummary;
    expect(body.plan).toBe("pro");
    expect(body.usage.repositories).toEqual({ used: 0, limit: 50 });
    expect(body.usage.members).toEqual({ used: 1, limit: 5 });
    expect(body.subscription_status).toBe("active");
    expect(body.next_billing_date).toBe("2026-07-01T00:00:00.000Z");
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]?.id).toBe("in_test_1");
  });

  it("rejects billing access for admin and member roles", async () => {
    const app = createTestApp(database, mockStripe);
    const owner = await seedUser(database, "billing-owner-gate");
    const admin = await seedUser(database, "billing-admin-gate");
    const member = await seedUser(database, "billing-member-gate");
    const workspace = await seedWorkspace(database, "billing-gate");
    await addMember(database, workspace.id, owner.id, "owner");
    await addMember(database, workspace.id, admin.id, "admin");
    await addMember(database, workspace.id, member.id, "member");

    const adminResponse = await app.request(`/api/v1/workspaces/${workspace.id}/billing`, {
      headers: {
        Authorization: `Bearer ${await bearerToken(admin.id, workspace.id, "admin")}`,
      },
    });
    expect(adminResponse.status).toBe(403);

    const memberResponse = await app.request(`/api/v1/workspaces/${workspace.id}/billing`, {
      headers: {
        Authorization: `Bearer ${await bearerToken(member.id, workspace.id, "member")}`,
      },
    });
    expect(memberResponse.status).toBe(403);
  });

  it("creates checkout session with workspace billing return URLs", async () => {
    const app = createTestApp(database, mockStripe);
    const owner = await seedUser(database, "billing-checkout");
    const workspace = await seedWorkspace(database, "billing-checkout");
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `/api/v1/workspaces/${workspace.id}/billing/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "pro" }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(body.url).toContain("https://checkout.stripe.test/session");

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro_test", quantity: 1 }],
        success_url: `https://cloud.pipewatch.app/workspaces/${workspace.slug}/settings/billing?checkout=success`,
        cancel_url: `https://cloud.pipewatch.app/workspaces/${workspace.slug}/settings/billing?checkout=cancelled`,
      }),
    );

    const [workspaceRow] = await database
      .select({ stripeCustomerId: workspaces.stripeCustomerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id));

    expect(workspaceRow?.stripeCustomerId).toBe("cus_test_123");
  });

  it("creates portal session with billing page return URL", async () => {
    const app = createTestApp(database, mockStripe);
    const owner = await seedUser(database, "billing-portal");
    const workspace = await seedWorkspace(database, "billing-portal", {
      stripeCustomerId: "cus_portal",
    });
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(
      `/api/v1/workspaces/${workspace.id}/billing/portal`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(body.url).toContain("https://billing.stripe.test/portal");

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_portal",
      return_url: `https://cloud.pipewatch.app/workspaces/${workspace.slug}/settings/billing`,
    });
  });

  it("returns 404 when STRIPE_ENABLED is false", async () => {
    editionMock.flags.STRIPE_ENABLED = false;

    const app = createTestApp(database, mockStripe);
    const owner = await seedUser(database, "billing-disabled");
    const workspace = await seedWorkspace(database, "billing-disabled");
    await addMember(database, workspace.id, owner.id, "owner");

    const response = await app.request(`/api/v1/workspaces/${workspace.id}/billing`, {
      headers: {
        Authorization: `Bearer ${await bearerToken(owner.id, workspace.id, "owner")}`,
      },
    });

    expect(response.status).toBe(404);

    editionMock.flags.STRIPE_ENABLED = true;
  });
});
