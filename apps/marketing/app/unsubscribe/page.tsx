import type { Metadata } from "next";

import { WaitlistStatusCard } from "@/components/waitlist/WaitlistStatusCard";
import type { WaitlistStatusVariant } from "@/components/waitlist/WaitlistStatusCard";
import { unsubscribeWaitlistToken } from "@/lib/waitlist-api";
import { assertWaitlistRouteAccessible } from "@/lib/waitlist-guard";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Unsubscribe from PipeWatch waitlist emails.",
};

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  assertWaitlistRouteAccessible();

  const { token } = await searchParams;
  if (!token) {
    return <WaitlistStatusCard variant="invalid_expired" />;
  }

  const result = await unsubscribeWaitlistToken(token);
  if (!result.ok) {
    return (
      <WaitlistStatusCard
        variant={result.error === "network" ? "network_error" : "invalid_expired"}
      />
    );
  }

  if (result.status === "unsubscribed" || result.status === "already_unsubscribed") {
    return <WaitlistStatusCard variant={result.status satisfies WaitlistStatusVariant} />;
  }

  return <WaitlistStatusCard variant="invalid_expired" />;
}
