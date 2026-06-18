# @pipewatch/db

Drizzle ORM package for PipeWatch — schema, migrations, and the shared database client.

## Migration policy

**`packages/db/schema/` is the only source of truth for database shape.** If it is not in the schema, it does not exist.

1. Edit TypeScript schema files under `schema/`.
2. Generate a migration: `pnpm db:generate` (runs Drizzle Kit `generate` via Turborepo).
3. Commit schema changes and the new timestamped directory under `drizzle/` together in the same task.

**Never:**

- Hand-write SQL migration files
- Create migration directories manually
- Edit or delete committed migration files
- Use `drizzle-kit push` or any workflow that bypasses migration history

To change the database after a migration has shipped, edit the schema and run `pnpm db:generate` again so Drizzle Kit produces a **new** forward-only migration.

## Scripts

| Command | Description |
|---|---|
| `pnpm db:generate` | Generate migrations from schema (repo root) |
| `pnpm --filter @pipewatch/db db:migrate` | Apply pending migrations (`drizzle-kit migrate`) |

Both commands require `DATABASE_URL` (PostgreSQL connection string). Cloud deploys use the unpooled Neon URL for migrations; CE runs migrations at API startup.

## Client

```typescript
import { createDb, db, withTransaction } from "@pipewatch/db";

// Lazy singleton from process.env.DATABASE_URL
await db.execute(sql`SELECT 1`);

// Explicit URL (tests, scripts)
const testDb = createDb(process.env.DATABASE_URL!);

await withTransaction(testDb, async (tx) => {
  // ...
});
```

Neon (`*.neon.tech`) uses `@neondatabase/serverless`; embedded Postgres and other hosts use `postgres` (postgres.js).
