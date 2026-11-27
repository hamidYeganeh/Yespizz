import { redirect } from "next/navigation";
import AuthFlow from "./auth-flow";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string; methods?: string }> }) {
  const query = await searchParams;
  if (query.methods) redirect("/auth/methods");
  return <AuthFlow oauthFailed={Boolean(query.error)} />;
}
