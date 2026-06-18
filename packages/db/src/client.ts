import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Db = PostgresJsDatabase;

let singletonClient: postgres.Sql | undefined;
let singletonDb: Db | undefined;

/** Create a Drizzle client for Neon or standard Postgres via connection URL. */
export function createDb(databaseUrl: string): Db {
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client);
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

/** Return the shared database client, initializing from `DATABASE_URL` on first use. */
export function getDb(): Db {
  if (!singletonDb) {
    singletonClient = postgres(requireDatabaseUrl(), { max: 10 });
    singletonDb = drizzle(singletonClient);
  }

  return singletonDb;
}

/**
 * Shared database client — lazy-initialized from `DATABASE_URL`.
 * Prefer `createDb()` in tests or when injecting an explicit connection URL.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance) as unknown;

    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }

    return value;
  },
});

/** Close the pooled Postgres.js client when one was created for this process. */
export async function closeDb(): Promise<void> {
  if (singletonClient) {
    await singletonClient.end({ timeout: 5 });
    singletonClient = undefined;
    singletonDb = undefined;
  }
}
