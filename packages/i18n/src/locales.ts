export const defaultLocale = "en";
export const localeCookie = "yespiz-locale";
export const locales = ["en", "nl-AT"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}
