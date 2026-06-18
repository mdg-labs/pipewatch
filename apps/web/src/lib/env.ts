/**
 * Public API base URL for client-side requests.
 * Validated at startup via parseWebEnv in instrumentation.ts.
 */
export const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
