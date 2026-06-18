import { randomBytes } from "node:crypto";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv, type ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { users } from "@pipewatch/db/schema";

import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken, type SignAccessTokenInput } from "../services/auth/jwt.js";
import { uniqueGithubId } from "../testing/unique-github-id.js";
import type { ApiEnv } from "../types.js";

/**
 * API integration test harness.
 *
 * Uses Hono's native `app.request()` instead of Supertest: the API is built on
 * Hono + @hono/zod-openapi, and every integration test already exercises routes
 * through `app.request()` without binding a TCP port. Supertest would add a
 * dependency and an extra HTTP layer without improving fidelity for this stack.
 */

export const API_TEST_JWT_SECRET = "a".repeat(32);
export const API_TEST_JWT_REFRESH_SECRET = "b".repeat(32);

export type PipeWatchTestEdition = "ce" | "cloud";

export type ApiTestEnvOverrides = Record<string, string>;

export type SeedTestUser = {
  id: string;
  githubLogin: string;
  email: string;
  name: string;
};

export type ApiTestAppContext = {
  env: ParsedApiEnv;
  db: Db;
};

export type RegisterApiTestRoutes = (
  app: OpenAPIHono<ApiEnv>,
  context: ApiTestAppContext,
) => void;

export function buildApiTestEnv(overrides: ApiTestEnvOverrides = {}): Record<string, string> {
  return {
    NODE_ENV: "development",
    PIPEWATCH_EDITION: "cloud",
    JWT_SECRET: API_TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: API_TEST_JWT_REFRESH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    ...overrides,
  };
}

export function createApiTestApp(
  database: Db,
  registerRoutes: RegisterApiTestRoutes,
  options: { edition?: PipeWatchTestEdition; envOverrides?: ApiTestEnvOverrides } = {},
): OpenAPIHono<ApiEnv> {
  const edition = options.edition ?? "cloud";
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...buildApiTestEnv(options.envOverrides),
      PIPEWATCH_EDITION: edition,
      DATABASE_URL: process.env.DATABASE_URL ?? "",
    },
    edition,
  );

  registerRoutes(app, { env, db: database });

  return app;
}

export async function seedTestUser(
  database: Db,
  loginPrefix: string,
): Promise<SeedTestUser> {
  const suffix = randomBytes(4).toString("hex");

  const [user] = await database
    .insert(users)
    .values({
      githubId: uniqueGithubId(),
      githubLogin: `${loginPrefix}-${suffix}`,
      email: `${loginPrefix}-${suffix}@example.com`,
      name: "Profile User",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  return {
    id: user.id,
    githubLogin: user.githubLogin,
    email: user.email!,
    name: user.name!,
  };
}

export async function signTestAccessToken(
  input: SignAccessTokenInput,
  secret: string = API_TEST_JWT_SECRET,
): Promise<string> {
  return signAccessToken(input, secret);
}

/** Issue a GET/POST/etc. against a test app without starting an HTTP server. */
export async function requestApi(
  app: OpenAPIHono<ApiEnv>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return await app.request(`http://localhost${path}`, init);
}
