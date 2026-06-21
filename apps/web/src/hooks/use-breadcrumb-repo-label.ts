"use client";

import type { RepositorySummary } from "@pipewatch/types";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useApi } from "@/hooks/use-api";
import { extractRepoIdFromPath } from "@/hooks/use-repo-stream";

/** Resolves `full_name` for the repo segment on B4–B6 routes (Page Inventory §B3–B6). */
export function useBreadcrumbRepoLabel(): string | undefined {
  const pathname = usePathname() ?? "";
  const repoId = extractRepoIdFromPath(pathname);
  const { workspace } = useApi();
  const [fullName, setFullName] = useState<string | undefined>();

  useEffect(() => {
    if (!repoId || !workspace) {
      setFullName(undefined);
      return;
    }

    let cancelled = false;

    void workspace
      .get<RepositorySummary>(`/repositories/${repoId}`)
      .then((repo) => {
        if (!cancelled) {
          setFullName(repo.full_name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullName(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repoId, workspace]);

  return fullName;
}
