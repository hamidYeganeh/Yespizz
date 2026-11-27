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
  "de-AT": () => import("./messages/de-AT")
} satisfies Record<Locale, () => Promise<{default: typeof english}>>;

export default getRequestConfig(async () => {
  const saved = process.env.YESPIZ_NATIVE_EXPORT === "1" ? "en" : (await cookies()).get(localeCookie)?.value;
  const locale = saved === "nl-AT" ? "de-AT" : isLocale(saved) ? saved : defaultLocale;
  return {locale, messages: (await catalogs[locale]()).default};
});
