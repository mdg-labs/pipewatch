"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";

type LiveStreamOverrideContextValue = {
  status: LiveConnectionStatus | null;
  setStatus: (status: LiveConnectionStatus | null) => void;
  isClaimed: boolean;
  claimOverride: () => void;
  releaseOverride: () => void;
};

const LiveStreamOverrideContext = createContext<LiveStreamOverrideContextValue>({
  status: null,
  setStatus: () => undefined,
  isClaimed: false,
  claimOverride: () => undefined,
  releaseOverride: () => undefined,
});

export type LiveStreamOverrideProviderProps = {
  children: ReactNode;
};

/** Allows dashboard multi-repo SSE to drive the app-shell live indicator. */
export function LiveStreamOverrideProvider({ children }: LiveStreamOverrideProviderProps) {
  const [status, setStatus] = useState<LiveConnectionStatus | null>(null);
  const [claimCount, setClaimCount] = useState(0);

  const claimOverride = useCallback(() => {
    setClaimCount((current) => current + 1);
  }, []);

  const releaseOverride = useCallback(() => {
    setClaimCount((current) => Math.max(0, current - 1));
  }, []);

  const value = useMemo(
    () => ({
      status,
      setStatus,
      isClaimed: claimCount > 0,
      claimOverride,
      releaseOverride,
    }),
    [claimCount, claimOverride, releaseOverride, status],
  );

  return createElement(LiveStreamOverrideContext.Provider, { value }, children);
}

export function useLiveStreamOverride(): LiveConnectionStatus | null {
  return useContext(LiveStreamOverrideContext).status;
}

export function useSetLiveStreamOverride(): (status: LiveConnectionStatus | null) => void {
  return useContext(LiveStreamOverrideContext).setStatus;
}

export function useLiveStreamOverrideClaim(): {
  isClaimed: boolean;
  claimOverride: () => void;
  releaseOverride: () => void;
} {
  const { isClaimed, claimOverride, releaseOverride } = useContext(LiveStreamOverrideContext);
  return { isClaimed, claimOverride, releaseOverride };
}
