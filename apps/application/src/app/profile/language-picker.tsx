"use client";

import { Radio, RadioGroup } from "@heroui/react";
import { changeLocale } from "@repo/i18n/actions";
import { isLocale, locales, type Locale } from "@repo/i18n/locales";
import { useTransition } from "react";

const languages = {
  en: { name: "English (US)", flag: "us" },
  "de-AT": { name: "Deutsch (Österreich)", flag: "at" },
} satisfies Record<Locale, { name: string; flag: string }>;

export function LanguagePicker({ locale, label }: { locale: Locale; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <RadioGroup className="locale-list" name="language" aria-label={label} value={locale} isDisabled={pending}
      onChange={value => {
        if (!isLocale(value) || value === locale) return;
        const form = new FormData();
        form.set("locale", value);
        startTransition(() => changeLocale(form));
      }}>
      {locales.map((value, index) => (
        <Radio key={value} value={value} style={{ animationDelay: `${index * 55}ms` }} className="locale-radio">
          <Radio.Content>
            <img src={`/profile/flag-${languages[value].flag}.svg`} width={32} height={22} alt="" />
            <span lang={value}>{languages[value].name}</span>
            <Radio.Control><Radio.Indicator /></Radio.Control>
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
