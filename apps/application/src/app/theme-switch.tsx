"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { AnimatedThemeToggler } from "./components/animated-theme-toggler";

export function ThemeSwitch({ row = false }: { row?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Application.home");
  return <AnimatedThemeToggler duration={650} className={row ? "profile-row profile-theme-row w-full text-start" : "theme-toggle"} aria-label={row ? undefined : t("theme")} title={t("theme")}
    theme={resolvedTheme === "light" ? "light" : "dark"} onThemeChange={setTheme}>{row && <><span className="flex-1">{t("themeLabel")}</span><small>{t(resolvedTheme === "light" ? "lightMode" : "darkMode")}</small></>}</AnimatedThemeToggler>;
}
