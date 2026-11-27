import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
const config: CapacitorConfig = {
  appId: "com.yespiz.application",
  appName: "Yespiz",
  webDir: serverUrl ? "native-web" : ".native-export/out",
  ...(serverUrl && {server: {url: new URL(serverUrl).href, cleartext: serverUrl.startsWith("http://")}}),
};
export default config;
