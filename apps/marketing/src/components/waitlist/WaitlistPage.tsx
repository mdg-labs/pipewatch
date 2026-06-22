import { flags } from "@pipewatch/config/edition";

import { WaitlistForm } from "./WaitlistForm";
import { WaitlistLayout } from "./WaitlistLayout";

const LAUNCH_TIMELINE =
  "PipeWatch Cloud is launching soon — join for early access and launch updates.";

export function WaitlistPage() {
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
