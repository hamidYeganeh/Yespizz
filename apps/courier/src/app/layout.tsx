import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import { SystemTheme } from "../../../../packages/ui/src/system-theme";
import "../../../../packages/ui/styles/theme.css";
import "../../../../packages/ui/styles/courier.css";
export const metadata={title:"Yespizz Courier"};
export default function Layout({ children }: { children: React.ReactNode }) {
  // Capacitor sets safe-area CSS properties on the root before hydration.
  return <html lang="en" suppressHydrationWarning><body style={{ margin: 0 }}><SystemTheme />{children}</body></html>;
}
