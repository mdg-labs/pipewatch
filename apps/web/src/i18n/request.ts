import { getRequestConfig } from "next-intl/server";

import { defaultLocale } from "./config";
import { missingMessageFallback, warnMissingMessage } from "./missing-message";

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        warnMissingMessage(error);
      }
    },
    getMessageFallback: missingMessageFallback,
  };
});
