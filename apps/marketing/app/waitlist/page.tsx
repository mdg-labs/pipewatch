import type { Metadata } from "next";

import { flags } from "@pipewatch/config/edition";

import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { WaitlistLayout } from "@/components/waitlist/WaitlistLayout";
import { assertWaitlistRouteAccessible } from "@/lib/waitlist-guard";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description:
    "Get notified when PipeWatch Cloud launches — real-time GitHub Actions across all your repositories.",
};

const LAUNCH_TIMELINE =
  "PipeWatch Cloud is launching soon — join for early access and launch updates.";

export default function WaitlistPage() {
  assertWaitlistRouteAccessible();

  return (
    <WaitlistLayout
      title="Join the PipeWatch waitlist"
      subtitle="Be first to know when PipeWatch Cloud launches."
      timeline={flags.WAITLIST_ENABLED ? LAUNCH_TIMELINE : undefined}
    >
      <WaitlistForm />
    </WaitlistLayout>
  );
}
