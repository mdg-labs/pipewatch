/** Runtime env keys required in staging/production — shared by env.ts and sync-secrets manifest. */

export const API_STRICT_FIELDS = [
  "DATABASE_URL",
  "REDIS_URL",
  "ENCRYPTION_KEY",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_SLUG",
  "APP_URL",
  "MARKETING_URL",
] as const;

export const API_CLOUD_STRICT_FIELDS = [
  "POSTMARK_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_BUSINESS",
] as const;

export const WORKER_STRICT_FIELDS = [
  "DATABASE_URL",
  "REDIS_URL",
  "ENCRYPTION_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

export const WEB_STRICT_FIELDS = ["NEXT_PUBLIC_API_URL"] as const;

export const MARKETING_CLOUD_STRICT_FIELDS = [
  "UMAMI_SCRIPT_URL",
  "UMAMI_WEBSITE_ID",
] as const;
