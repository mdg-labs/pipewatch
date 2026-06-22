import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const changelog = defineCollection({
  loader: glob({ base: "./content/changelog", pattern: "**/*.md" }),
  schema: z.object({
    version: z.string(),
    date: z.string(),
    summary: z.string(),
    releaseUrl: z.string().optional(),
  }),
});

const legal = defineCollection({
  loader: glob({ base: "./content/legal", pattern: "**/*.mdx" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lastUpdated: z.string(),
  }),
});

export const collections = { changelog, legal };
