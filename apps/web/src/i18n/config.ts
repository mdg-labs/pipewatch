import supportedLocales from "./supported-locales.json";

export const locales = supportedLocales.locales;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = supportedLocales.defaultLocale;
export const fallbackLocale: AppLocale = supportedLocales.fallbackLocale;

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
