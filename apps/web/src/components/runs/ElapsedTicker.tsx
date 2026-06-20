"use client";

import { useEffect, useState } from "react";

import { useTimeFormatters } from "@/i18n/use-time-formatters";

export type ElapsedTickerProps = {
  startedAt: string;
  className?: string;
};

/** Live elapsed-time display for in-progress jobs (page B6, SSE). */
export function ElapsedTicker({ startedAt, className }: ElapsedTickerProps) {
  const { formatElapsedSince } = useTimeFormatters();
  const [elapsed, setElapsed] = useState(() => formatElapsedSince(startedAt));

  useEffect(() => {
    const tick = () => {
      setElapsed(formatElapsedSince(startedAt));
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [formatElapsedSince, startedAt]);

  return (
    <span className={className} aria-live="polite">
      {elapsed}
    </span>
  );
}
