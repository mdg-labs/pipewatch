type UmamiTrackData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: UmamiTrackData) => void;
    };
  }
}

/** Fire an Umami event — no-op when script is absent (CE or unconfigured). */
export function trackUmamiEvent(event: string, data?: UmamiTrackData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.umami?.track(event, data);
}
