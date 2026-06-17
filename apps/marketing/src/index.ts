import { UTILS_PACKAGE_NAME } from "@pipewatch/utils";

export const MARKETING_PACKAGE_NAME = "@pipewatch/marketing" as const;

export function getMarketingStub(): { utils: typeof UTILS_PACKAGE_NAME } {
  return {
    utils: UTILS_PACKAGE_NAME,
  };
}
