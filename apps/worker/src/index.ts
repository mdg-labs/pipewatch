import { DB_PACKAGE_NAME } from "@pipewatch/db";
import type { Placeholder } from "@pipewatch/types";
import { UTILS_PACKAGE_NAME } from "@pipewatch/utils";

export const WORKER_PACKAGE_NAME = "@pipewatch/worker" as const;

export function getWorkerStub(): {
  db: typeof DB_PACKAGE_NAME;
  types: Placeholder;
  utils: typeof UTILS_PACKAGE_NAME;
} {
  return {
    db: DB_PACKAGE_NAME,
    types: {},
    utils: UTILS_PACKAGE_NAME,
  };
}
