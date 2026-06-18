import { GITHUB_REPO_URL } from "./marketing-links";

const GITHUB_API_REPO = `${GITHUB_REPO_URL.replace("https://github.com", "https://api.github.com/repos")}`;

/** Fetch public stargazer count — cached for one hour; null on failure. */
export async function getGitHubStarCount(): Promise<number | null> {
  try {
    const response = await fetch(GITHUB_API_REPO, {
      next: { revalidate: 3600 },
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "stargazers_count" in payload &&
      typeof payload.stargazers_count === "number"
    ) {
      return payload.stargazers_count;
    }

    return null;
  } catch {
    return null;
  }
}
