/**
 * Read-only cross-schema references to `public.*` tables (Admin PRD §5.2, §8.5).
 * Import via `@pipewatch/db-admin/public-read` — do not duplicate table definitions.
 */
export {
  integrations as publicIntegrations,
  workspaces as publicWorkspaces,
} from "@pipewatch/db/schema";
