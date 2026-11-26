"use server";

import {cookies} from "next/headers";
import {isLocale, localeCookie} from "./locales";

export async function changeLocale(form: FormData) {
  const locale = form.get("locale");
  if (isLocale(locale)) {
    (await cookies()).set(localeCookie, locale, {
      path: "/", httpOnly: true, sameSite: "lax", maxAge: 31536000
    });
  }
}
