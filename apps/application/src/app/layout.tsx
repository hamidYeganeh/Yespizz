import "@fontsource-variable/inter";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import "./globals.css";

export async function generateMetadata() {
  const t = await getTranslations("Application.home");
  return {title: `Yespiz · ${t("title")}`};
}

export default async function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html lang={await getLocale()}>
      <body><NextIntlClientProvider>{children}</NextIntlClientProvider></body>
    </html>
  );
}
