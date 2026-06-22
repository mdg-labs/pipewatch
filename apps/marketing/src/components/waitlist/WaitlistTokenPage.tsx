import { useEffect, useState } from "react";

import {
  confirmWaitlistToken,
  unsubscribeWaitlistToken,
} from "@/lib/waitlist-api";

import { WaitlistLayout } from "./WaitlistLayout";
import { WaitlistStatusCard, type WaitlistStatusVariant } from "./WaitlistStatusCard";

type WaitlistTokenAction = "confirm" | "unsubscribe";

type WaitlistTokenPageProps = {
  action: WaitlistTokenAction;
  token: string | null;
};

function resolveVariant(
  action: WaitlistTokenAction,
  result:
    | { ok: true; status: string }
    | { ok: false; error: "invalid_token" | "network" },
): WaitlistStatusVariant {
  if (!result.ok) {
    return result.error === "network" ? "network_error" : "invalid_expired";
  }

  if (action === "confirm") {
    if (result.status === "confirmed" || result.status === "already_confirmed") {
      return result.status;
    }
    return "invalid_expired";
  }

  if (result.status === "unsubscribed" || result.status === "already_unsubscribed") {
    return result.status;
  }

  return "invalid_expired";
}

export function WaitlistTokenPage({ action, token }: WaitlistTokenPageProps) {
  const [variant, setVariant] = useState<WaitlistStatusVariant | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        if (!cancelled) {
          setVariant("invalid_expired");
        }
        return;
      }

      const result =
        action === "confirm"
          ? await confirmWaitlistToken(token)
          : await unsubscribeWaitlistToken(token);

      if (!cancelled) {
        setVariant(resolveVariant(action, result));
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [action, token]);

  if (variant === null) {
    return (
      <WaitlistLayout
        title="Processing…"
        subtitle="Please wait while we verify your link."
      />
    );
  }

  return <WaitlistStatusCard variant={variant} umamiAction={action} />;
}
