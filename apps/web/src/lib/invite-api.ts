import type { ApiError, WorkspaceRole } from "@pipewatch/types";

import { getAccessToken } from "./auth";

export type InvitePreview = {
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
};

export type AcceptInviteResult = {
  workspace_id: string;
  workspace_name: string;
  role: WorkspaceRole;
};

export class InviteApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "InviteApiError";
    this.status = status;
    this.code = error.code;
  }
}

function buildInviteUrl(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/$/, "")}${path}`;
}

async function parseInviteApiError(response: Response): Promise<InviteApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: ApiError };
      if (body.error?.code && body.error.message) {
        return new InviteApiError(response.status, body.error);
      }
    } catch {
      // Fall through to generic error.
    }
  }

  return new InviteApiError(response.status, {
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
  });
}

/** Public invite validation (`GET /invite/:token`, pages B18). */
export async function fetchInvitePreview(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InvitePreview> {
  const response = await fetchImpl(buildInviteUrl(apiUrl, `/invite/${token}`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw await parseInviteApiError(response);
  }

  return (await response.json()) as InvitePreview;
}

/** Accept invite for the signed-in user (`POST /invite/:token/accept`, pages B18). */
export async function acceptInvite(
  apiUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AcceptInviteResult> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetchImpl(buildInviteUrl(apiUrl, `/invite/${token}/accept`), {
    method: "POST",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw await parseInviteApiError(response);
  }

  return (await response.json()) as AcceptInviteResult;
}
