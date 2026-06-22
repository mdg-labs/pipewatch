import { GITHUB_REPO_URL } from "./marketing-links";

const GITHUB_API_REPO = `${GITHUB_REPO_URL.replace("https://github.com", "https://api.github.com/repos")}`;
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedStars: { count: number | null; fetchedAt: number } | null = null;

/** Fetch public stargazer count — cached for one hour; null on failure. */
export async function getGitHubStarCount(): Promise<number | null> {
  const now = Date.now();
  if (cachedStars && now - cachedStars.fetchedAt < CACHE_TTL_MS) {
    return cachedStars.count;
  }

  let count: number | null = null;

  try {
    const response = await fetch(GITHUB_API_REPO, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (response.ok) {
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "stargazers_count" in payload &&
        typeof payload.stargazers_count === "number"
      ) {
        count = payload.stargazers_count;
      }
    }
  } catch {
    count = null;
  }

  cachedStars = { count, fetchedAt: now };
  return count;
}
