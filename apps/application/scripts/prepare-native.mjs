import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.CAPACITOR_SERVER_URL) {
  const app = fileURLToPath(new URL("../", import.meta.url));
  const staging = join(app, ".native-export");
  mkdirSync(staging, { recursive: true });
  // Keep the server-backed routes intact in the web application.
  for (const entry of ["src", "public"]) {
    rmSync(join(staging, entry), { recursive: true, force: true });
    cpSync(join(app, entry), join(staging, entry), { recursive: true });
  }
  for (const entry of ["next.config.ts", "tsconfig.json"]) cpSync(join(app, entry), join(staging, entry));

  const replace = (file, body) => writeFileSync(join(staging, "src", file), body);
  rmSync(join(staging, "src/app/api"), { recursive: true, force: true });
  for (const file of ["commerce.ts", "places.ts"]) rmSync(join(staging, "src/lib", file), { force: true });
  replace("app/auth/actions.ts", `
export async function needsPassword() { return false; }
export async function registerPassword(_password: string) { return { error: null }; }
export async function saveContactPhone(_phone: string) { return { error: null }; }
export async function verifyRecoveryCode(_email: string, _code: string) { return { error: "Email recovery is unavailable in the offline demo." }; }
export async function resetVerifiedPassword(_password: string) { return { error: "Email recovery is unavailable in the offline demo." }; }
`);
  replace("lib/auth-client.ts", `
const success = async (_input?: unknown) => ({ error: null });
const unavailable = async (_input?: unknown) => ({ error: { message: "Email and social sign-in require a server. Use the demo entry." } });
export const authClient = {
  useSession: (): { data: { user: { inviteCode?: string } } | null; isPending: boolean } => ({ data: null, isPending: false }),
  signOut: success,
  signIn: { social: unavailable, email: unavailable, emailOtp: unavailable },
  emailOtp: { requestPasswordReset: unavailable, sendVerificationOtp: unavailable },
};
`);
  replace("app/auth/page.tsx", `import AuthFlow from "./auth-flow"; export default function Page() { return <AuthFlow />; }`);
  replace("app/auth/set-password/page.tsx", `import AuthFlow from "../auth-flow"; export default function Page() { return <AuthFlow initialStep="password" />; }`);
  replace("app/basket/page.tsx", `import { redirect } from "next/navigation"; export default function Page() { redirect("/payment"); }`);
  const language = join(staging, "src/app/profile/language-picker.tsx");
  writeFileSync(language, readFileSync(language, "utf8").replace(
    'import { changeLocale } from "@repo/i18n/actions";',
    'const changeLocale = async () => { alert("The offline demo uses English."); };',
  ).replace("changeLocale(form)", "changeLocale()"));

  const require = createRequire(import.meta.url);
  const build = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
    cwd: staging,
    env: { ...process.env, YESPIZ_NATIVE_EXPORT: "1", NEXT_PUBLIC_YESPIZ_OFFLINE: "1" },
    stdio: "inherit",
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}
