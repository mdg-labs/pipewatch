import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";
import { getLegalPageMeta } from "@/lib/legal";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = getLegalPageMeta("privacy");

  return {
    title,
    description,
  };
}

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
