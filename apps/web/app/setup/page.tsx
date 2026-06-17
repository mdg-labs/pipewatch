import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { flags } from "@pipewatch/config/edition";

import { BootstrapCard } from "@/components/auth/BootstrapCard";
import { buildGitHubOAuthUrl, getMarketingSiteUrl } from "@/lib/auth-redirect";
import { hasAuthSession } from "@/lib/auth-cookies";
import { fetchBootstrapStatus } from "@/lib/bootstrap";
import { publicApiUrl } from "@/lib/env";

import "@/components/auth/bootstrap.css";

/** CE first-run bootstrap — owner account via GitHub OAuth (pages B0). */
export default async function SetupPage() {
  if (!flags.BOOTSTRAP_ENABLED) {
    notFound();
  }

  const status = await fetchBootstrapStatus({ apiUrl: publicApiUrl });
  if (!status.bootstrapRequired) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  if (hasAuthSession(cookieStore)) {
    redirect("/onboarding?step=2");
  }

  const oauthUrl = buildGitHubOAuthUrl(publicApiUrl);
  const marketingUrl = getMarketingSiteUrl();

  return (
    <main className="pw-bootstrap-page">
      <BootstrapCard oauthUrl={oauthUrl} marketingUrl={marketingUrl} />
    </main>
  );
}
