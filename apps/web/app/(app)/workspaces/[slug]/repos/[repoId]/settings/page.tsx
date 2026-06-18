"use client";

import { useParams } from "next/navigation";

import { RepoSettingsForm } from "@/components/repos/RepoSettingsForm";

/** Per-repository settings — sync mode, retention, disable/delete (B5). */
export default function RepositorySettingsPage() {
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;

  if (!repoId) {
    return null;
  }

  return <RepoSettingsForm repoId={repoId} />;
}
