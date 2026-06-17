import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { flags } from "@pipewatch/config/edition";

import { SignInCard } from "@/components/auth/SignInCard";
import {
  buildGitHubOAuthUrl,
  getMarketingSiteUrl,
  parseNextParam,
} from "@/lib/auth-redirect";
import { hasAuthSession } from "@/lib/auth-cookies";
import { fetchBootstrapStatus } from "@/lib/bootstrap";
import { publicApiUrl } from "@/lib/env";

import "@/components/auth/sign-in.css";

type SignInPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  if (flags.BOOTSTRAP_ENABLED) {
    const status = await fetchBootstrapStatus({ apiUrl: publicApiUrl });
    if (status.bootstrapRequired) {
      redirect("/setup");
    }
  }

  const cookieStore = await cookies();
  if (hasAuthSession(cookieStore)) {
    redirect(parseNextParam(next) ?? "/");
  }

  const oauthUrl = buildGitHubOAuthUrl(publicApiUrl, next);
  const marketingUrl = getMarketingSiteUrl();

  return (
    <main className="pw-sign-in-page">
      <SignInCard oauthUrl={oauthUrl} marketingUrl={marketingUrl} />
    </main>
  );
}
