import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "../api/client.js";

export type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiRequestError | null;
  retry: () => void;
};

export function useApiQuery<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const depKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await loader();
        if (!cancelled) {
          setData(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiRequestError
              ? caught
              : new ApiRequestError("Unexpected error", 500, "INTERNAL_ERROR"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [attempt, depKey]);

  return { data, loading, error, retry };
}
