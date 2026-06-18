/** Pipeline execution status — populated with Zod schemas in P2/P3. */
export type PipelineStatus = "queued" | "in_progress" | "completed";

/** Pipeline outcome — null while status is not completed. */
export type PipelineConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | null;

/** Workspace membership role. */
export type WorkspaceRole = "owner" | "admin" | "member";

/** CI provider identifier — MVP allows `github` only. */
export type IntegrationProvider = "github";

/** Paginated list response envelope — fields finalized in P2/P3. */
export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

/** Standard API error shape — fields finalized in P2/P3. */
export interface ApiError {
  code: string;
  message: string;
}
