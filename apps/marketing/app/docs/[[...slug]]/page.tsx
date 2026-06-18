import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocsPage } from "@/components/docs";
import { getDocPageMeta, isValidDocSlug } from "@/lib/docs/content";
import { getAllDocSlugs, getDefaultDocSlug } from "@/lib/docs/nav-tree";

export const dynamic = "force-static";

type DocPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({
    slug: slug.split("/"),
  }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    const defaultMeta = getDocPageMeta(getDefaultDocSlug());
    return {
      title: defaultMeta.title,
      description: defaultMeta.description,
    };
  }

  const docSlug = slug.join("/");
  if (!isValidDocSlug(docSlug)) {
    return { title: "Not found" };
  }

  const meta = getDocPageMeta(docSlug);
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default async function DocCatchAllPage({ params }: DocPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    redirect(`/docs/${getDefaultDocSlug()}`);
  }

  const docSlug = slug.join("/");
  if (!isValidDocSlug(docSlug)) {
    notFound();
  }

  return <DocsPage slug={docSlug} />;
}
