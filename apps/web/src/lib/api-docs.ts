import { publicApiUrl } from "@/lib/env";

export const OPENAPI_DOCS_PATH = "/api/docs";

/** Resolve Scalar docs URL from configured API base URL. */
export function getApiDocsUrl(): string {
  const base = publicApiUrl.replace(/\/$/, "");
  return base ? `${base}${OPENAPI_DOCS_PATH}` : OPENAPI_DOCS_PATH;
}

export const API_AUTH_INSTRUCTIONS = {
  jwt: "Authorization: Bearer <access_token>",
  apiKey: "Authorization: Bearer pw_<your_api_key>",
} as const;
