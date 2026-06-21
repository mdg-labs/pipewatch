import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";

import type { ForgotPasswordRateLimitDeps } from "./middleware/forgot-password-rate-limit.js";
import type { EmailTransport } from "./services/mail/invite.js";

/** Platform operator roles — distinct from workspace `admin` (Admin PRD §8.1). */
export type AdminRole = "viewer" | "operator" | "platform_admin";

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
};

export type AdminAppBindings = {
  Variables: {
    env: AdminEnv;
    db: Db;
    emailTransport?: EmailTransport;
    adminUser: AdminUser;
    sessionId: string;
  };
};

export type AdminAppDeps = {
  env: AdminEnv;
  db: Db;
  emailTransport?: EmailTransport;
  forgotPasswordRateLimit?: ForgotPasswordRateLimitDeps;
};
