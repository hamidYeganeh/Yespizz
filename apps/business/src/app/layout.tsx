import type { Metadata } from "next";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-700.css";
import { SystemTheme } from "../../../../packages/ui/src/system-theme";
import "./globals.css";

export const metadata:Metadata = {title:"Yespiz Business", description:"Manage your restaurant profile."};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><SystemTheme />{children}</body></html>;
}
