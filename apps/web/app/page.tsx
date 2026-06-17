import { redirect } from "next/navigation";

import { getPlaceholderSession } from "@/lib/placeholder-session";

export default function HomePage() {
  const session = getPlaceholderSession();
  redirect(`/workspaces/${session.activeWorkspaceSlug}`);
}
