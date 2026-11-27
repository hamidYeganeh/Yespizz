import type { CapacitorConfig } from "@capacitor/cli";

const url = new URL(process.env.CAPACITOR_SERVER_URL || "http://127.0.0.1:17334");
const config: CapacitorConfig = {
  appId: "com.yespiz.courier",
  appName: "Yespizz Courier",
  webDir: "native-web",
  server: { url: url.href, cleartext: url.protocol === "http:" },
};

export default config;
