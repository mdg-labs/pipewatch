import type { ReactNode } from "react";

import { WaitlistLayout } from "./WaitlistLayout";

export type WaitlistStatusVariant =
  | "confirmed"
  | "already_confirmed"
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid_expired"
  | "network_error";

type StatusContent = {
  title: string;
  subtitle: string;
  icon: ReactNode;
};

function SuccessIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 17l4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function getStatusContent(variant: WaitlistStatusVariant): StatusContent {
  switch (variant) {
    case "confirmed":
      return {
        title: "Subscription confirmed",
        subtitle: "You're on the list. We'll email you when PipeWatch Cloud launches.",
        icon: <SuccessIcon />,
      };
    case "already_confirmed":
      return {
        title: "Already confirmed",
        subtitle: "This email is already confirmed on the waitlist.",
        icon: <SuccessIcon />,
      };
    case "unsubscribed":
      return {
        title: "Unsubscribed",
        subtitle: "You won't receive further waitlist emails from PipeWatch.",
        icon: <MailIcon />,
      };
    case "already_unsubscribed":
      return {
        title: "Already unsubscribed",
        subtitle: "This address is no longer on the PipeWatch waitlist.",
        icon: <MailIcon />,
      };
    case "network_error":
      return {
        title: "Something went wrong",
        subtitle: "We couldn't complete this request. Please try again in a moment.",
        icon: <AlertIcon />,
      };
    case "invalid_expired":
    default:
      return {
        title: "Invalid or expired link",
        subtitle: "This link is no longer valid. Join the waitlist again if you'd like updates.",
        icon: <AlertIcon />,
      };
  }
}

type WaitlistStatusCardProps = {
  variant: WaitlistStatusVariant;
};

export function WaitlistStatusCard({ variant }: WaitlistStatusCardProps) {
  const content = getStatusContent(variant);
  const isError = variant === "invalid_expired" || variant === "network_error";

  return (
    <WaitlistLayout
      title={content.title}
      subtitle={content.subtitle}
      statusIcon={
        <div className={isError ? "waitlist-status-icon-error" : undefined}>
          {content.icon}
        </div>
      }
    />
  );
}
