import { DragGuard } from "./components/drag-guard";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-900.css";
import "@fontsource/poppins/latin-900-italic.css";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import {ThemeProvider} from "next-themes";
import { SmoothScroll } from "./components/smooth-scroll";
import "./globals.css";
import "@repo/icons/styles.css";

export async function generateMetadata() {
  const t = await getTranslations("Application.home");
  return {title: `Yespiz · ${t("title")}`};
}

export default async function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html lang={await getLocale()} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <NextIntlClientProvider><DragGuard /><SmoothScroll />{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
