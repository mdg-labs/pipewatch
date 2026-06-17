import type { Placeholder } from "@pipewatch/types";
import { UI_PACKAGE_NAME } from "@pipewatch/ui";
import { UTILS_PACKAGE_NAME } from "@pipewatch/utils";

export const WEB_PACKAGE_NAME = "@pipewatch/web" as const;

export function getWebStub(): {
  types: Placeholder;
  ui: typeof UI_PACKAGE_NAME;
  utils: typeof UTILS_PACKAGE_NAME;
} {
  return {
    types: {},
    ui: UI_PACKAGE_NAME,
    utils: UTILS_PACKAGE_NAME,
  };
}
