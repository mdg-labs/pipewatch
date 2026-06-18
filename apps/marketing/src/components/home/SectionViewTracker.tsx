"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { trackUmamiEvent } from "@/lib/umami";

interface SectionViewTrackerProps {
  sectionId: string;
  eventName: string;
  children: ReactNode;
}

/** Fires a single Umami event when the section enters the viewport. */
export function SectionViewTracker({
  sectionId,
  eventName,
  children,
}: SectionViewTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          trackUmamiEvent(eventName, { section: sectionId });
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [eventName, sectionId]);

  return <div ref={ref}>{children}</div>;
}
