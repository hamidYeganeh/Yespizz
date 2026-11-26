"use client";

import { Button } from "@heroui/react/button";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

export function ThemeSwitch() {
  const { setTheme } = useTheme();
  const t = useTranslations("Application.home");
  return (
    <Button
      variant="secondary"
      onPress={() =>
        setTheme(
          document.documentElement.classList.contains("dark")
            ? "light"
            : "dark",
        )
      }
    >
      {t("theme")}
    </Button>
  );
}
