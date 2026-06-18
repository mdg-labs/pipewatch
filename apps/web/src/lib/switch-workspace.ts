import { parseAccessTokenFromSetCookie, setAccessToken } from "./auth";

export type SwitchWorkspaceResult = {
  ok: boolean;
};

/** Issue a JWT scoped to the given workspace via `POST /auth/switch-workspace`. */
export async function switchWorkspace(
  apiUrl: string,
  workspaceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SwitchWorkspaceResult> {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/auth/switch-workspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });

  if (!response.ok) {
    return { ok: false };
  }

  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (() => {
          const combined = response.headers.get("set-cookie");
          return combined ? [combined] : [];
        })();

  for (const header of setCookies) {
    const token = parseAccessTokenFromSetCookie(header);
    if (token) {
      setAccessToken(token);
      break;
    }
  }

  return { ok: true };
}
