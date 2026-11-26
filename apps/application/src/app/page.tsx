import {Button} from "@heroui/react/button";
import {changeLocale} from "@repo/i18n/actions";
import {getLocale, getTranslations} from "next-intl/server";

export default async function Home() {
  const [locale, t, language] = await Promise.all([
    getLocale(), getTranslations("Application.home"), getTranslations("Language")
  ]);
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <form action={changeLocale} className="mt-8 flex flex-wrap items-center gap-3">
        <label htmlFor="locale">{language("label")}</label>
        <select id="locale" name="locale" defaultValue={locale} className="rounded-md border px-3 py-2">
          <option value="en" lang="en">English</option>
          <option value="nl-AT" lang="nl">Nederlands</option>
        </select>
        <Button type="submit">{language("apply")}</Button>
      </form>
    </main>
  );
}
