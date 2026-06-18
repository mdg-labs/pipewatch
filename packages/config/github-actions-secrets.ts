/**
 * GitHub Actions secret consumption policy (PRD §10).
 *
 * Phase Console syncs **every** key to GitHub Actions as a **secret** — including
 * URLs, slugs, and public config. Workflows must use `${{ secrets.KEY }}`.
 *
 * Do not use `${{ vars.KEY }}` for Phase-synced values; the `ci` / `staging` /
 * `production` environments will not have matching GHA variables after sync.
 *
 * Exception: workflow-managed state (not from Phase) may use GHA variables —
 * see `GITHUB_ACTIONS_VAR_EXCEPTIONS`.
 */

/** GHA variables written by workflows — not synced from Phase. */
export const GITHUB_ACTIONS_VAR_EXCEPTIONS = ["DEPLOYED_VERSION"] as const;

export type GithubActionsVarException =
  (typeof GITHUB_ACTIONS_VAR_EXCEPTIONS)[number];

/** Credentials in the `ci` GHA environment (Phase CI → GHA secrets). */
export const CI_ENV_SECRETS = [
  "REPORTPORTAL_URL",
  "REPORTPORTAL_API_KEY",
  "REPORTPORTAL_PROJECT",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
] as const;

export type CiEnvSecret = (typeof CI_ENV_SECRETS)[number];
