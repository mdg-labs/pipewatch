import type { Metadata } from "next";

import { WaitlistStatusCard } from "@/components/waitlist/WaitlistStatusCard";
import type { WaitlistStatusVariant } from "@/components/waitlist/WaitlistStatusCard";
import { confirmWaitlistToken } from "@/lib/waitlist-api";
import { assertWaitlistRouteAccessible } from "@/lib/waitlist-guard";

export const metadata: Metadata = {
  title: "Confirm subscription",
  description: "Confirm your PipeWatch waitlist subscription.",
};

type ConfirmPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function WaitlistConfirmPage({ searchParams }: ConfirmPageProps) {
  assertWaitlistRouteAccessible();

  const { token } = await searchParams;
  if (!token) {
    return <WaitlistStatusCard variant="invalid_expired" />;
  }

  const result = await confirmWaitlistToken(token);
  if (!result.ok) {
    return (
      <WaitlistStatusCard
        variant={result.error === "network" ? "network_error" : "invalid_expired"}
      />
    );
  }

  if (result.status === "confirmed" || result.status === "already_confirmed") {
    return <WaitlistStatusCard variant={result.status satisfies WaitlistStatusVariant} />;
  }

  return <WaitlistStatusCard variant="invalid_expired" />;
}
