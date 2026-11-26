import {cookies} from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {defaultLocale, isLocale, localeCookie, type Locale} from "./locales";
import type english from "./messages/en";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof english;
  }
}

const catalogs = {
  en: () => import("./messages/en"),
  "nl-AT": () => import("./messages/nl-AT")
} satisfies Record<Locale, () => Promise<{default: typeof english}>>;

export default getRequestConfig(async () => {
  const saved = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(saved) ? saved : defaultLocale;
  return {locale, messages: (await catalogs[locale]()).default};
});
