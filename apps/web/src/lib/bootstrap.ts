import { flags } from "@pipewatch/config/edition";

export type BootstrapStatus = {
  bootstrapRequired: boolean;
  userCount: number;
};

export type FetchBootstrapStatusOptions = {
  apiUrl: string;
  fetchImpl?: typeof fetch;
};

const CACHE_TTL_MS = 5_000;

let cachedStatus: BootstrapStatus | null = null;
let cachedAt = 0;

/** Clear the middleware bootstrap status cache (tests). */
export function clearBootstrapStatusCache(): void {
  cachedStatus = null;
  cachedAt = 0;
}

/** Fetch CE bootstrap status from the public API (PRD §26, #49). */
export async function fetchBootstrapStatus(
  options: FetchBootstrapStatusOptions,
): Promise<BootstrapStatus> {
  if (!flags.BOOTSTRAP_ENABLED) {
    return { bootstrapRequired: false, userCount: 0 };
  }

  if (!options.apiUrl) {
    return { bootstrapRequired: true, userCount: 0 };
  }

  const base = options.apiUrl.replace(/\/$/, "");
  const fetchFn = options.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(`${base}/api/v1/public/bootstrap-status`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return { bootstrapRequired: false, userCount: 0 };
    }

    const body = (await response.json()) as Partial<BootstrapStatus>;
    return {
      bootstrapRequired: body.bootstrapRequired === true,
      userCount: typeof body.userCount === "number" ? body.userCount : 0,
    };
  } catch {
    return { bootstrapRequired: false, userCount: 0 };
  }
}

/** Cached bootstrap lookup for edge middleware (short TTL). */
export async function getBootstrapStatusForMiddleware(
  options: FetchBootstrapStatusOptions,
): Promise<BootstrapStatus> {
  if (!flags.BOOTSTRAP_ENABLED) {
    return { bootstrapRequired: false, userCount: 0 };
  }

  const now = Date.now();
  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const status = await fetchBootstrapStatus(options);
  cachedStatus = status;
  cachedAt = now;
  return status;
}
