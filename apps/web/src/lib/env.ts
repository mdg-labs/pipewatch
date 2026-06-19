/**
 * Public API base URL for client-side requests.
 * Must be set at build time (`NEXT_PUBLIC_API_URL`) — runtime Worker secrets do not
 * reach the client bundle. Validated at startup via parseWebEnv in instrumentation.ts.
 */
export const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
