/** Hono context variables shared across API middleware and routes. */
export type ApiVariables = {
  requestId: string;
};

export type ApiEnv = {
  Variables: ApiVariables;
};
