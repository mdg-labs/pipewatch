import type { Db } from "./client.js";

type TransactionCallback<T> = (tx: Db) => Promise<T>;

/** Run `callback` inside a single database transaction. */
export async function withTransaction<T>(
  database: Db,
  callback: TransactionCallback<T>,
): Promise<T> {
  return database.transaction(async (tx) => callback(tx as Db));
}
