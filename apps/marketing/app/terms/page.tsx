import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";
import { getLegalPageMeta } from "@/lib/legal";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = getLegalPageMeta("terms");

  return {
    title,
    description,
  };
}

export default function TermsPage() {
  return <LegalPage slug="terms" />;
}
