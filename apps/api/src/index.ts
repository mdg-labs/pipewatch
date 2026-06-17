import { DB_PACKAGE_NAME } from "@pipewatch/db";
import type { Placeholder } from "@pipewatch/types";
import { UTILS_PACKAGE_NAME } from "@pipewatch/utils";

export const API_PACKAGE_NAME = "@pipewatch/api" as const;

export function getApiStub(): {
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
