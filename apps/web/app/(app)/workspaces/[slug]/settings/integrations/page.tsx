import { IntegrationsSettingsView } from "@/components/settings/IntegrationsSettingsView";
import { publicApiUrl } from "@/lib/env";
import { fetchAppConfig } from "@/lib/public-config";

/** Workspace integrations settings — GitHub App install slug from API runtime (#175). */
export default async function WorkspaceIntegrationsSettingsPage() {
  const { githubAppSlug } = await fetchAppConfig({ apiUrl: publicApiUrl });

  return (
    <IntegrationsSettingsView {...(githubAppSlug ? { githubAppSlug } : {})} />
  );
}
