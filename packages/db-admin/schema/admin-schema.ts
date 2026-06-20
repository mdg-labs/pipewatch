import { pgSchema } from "drizzle-orm/pg-core";

/** Postgres `admin` schema — Cloud-only; separate migration path from `public`. */
export const adminSchema = pgSchema("admin");
