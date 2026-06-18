"use client";

import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";

type LiveStreamOverrideContextValue = {
  status: LiveConnectionStatus | null;
  setStatus: (status: LiveConnectionStatus | null) => void;
};

const LiveStreamOverrideContext = createContext<LiveStreamOverrideContextValue>({
  status: null,
  setStatus: () => undefined,
});

export type LiveStreamOverrideProviderProps = {
  children: ReactNode;
};

/** Allows dashboard multi-repo SSE to drive the app-shell live indicator. */
export function LiveStreamOverrideProvider({ children }: LiveStreamOverrideProviderProps) {
  const [status, setStatus] = useState<LiveConnectionStatus | null>(null);

  const value = useMemo(
    () => ({
      status,
      setStatus,
    }),
    [status],
  );

  return createElement(LiveStreamOverrideContext.Provider, { value }, children);
}

export function useLiveStreamOverride(): LiveConnectionStatus | null {
  return useContext(LiveStreamOverrideContext).status;
}

export function useSetLiveStreamOverride(): (status: LiveConnectionStatus | null) => void {
  return useContext(LiveStreamOverrideContext).setStatus;
}
