import { defineConfig } from "drizzle-kit";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for Drizzle Kit (generate/migrate).",
    );
  }
  return url;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/index.ts",
  out: "./drizzle",
  schemaFilter: ["admin"],
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
});
