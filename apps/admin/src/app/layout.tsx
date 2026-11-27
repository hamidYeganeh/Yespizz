import {NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import { SystemTheme } from "../../../../packages/ui/src/system-theme";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "./globals.css";

export async function generateMetadata() {
  const t = await getTranslations("Admin.home");
  return {title: `Yespiz · ${t("title")}`};
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang={await getLocale()} suppressHydrationWarning>
      <body><SystemTheme /><NextIntlClientProvider>{children}</NextIntlClientProvider></body>
    </html>
  );
}
