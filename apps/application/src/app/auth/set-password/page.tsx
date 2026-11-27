import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthFlow from "../auth-flow";

export default async function Page({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const setup = (await searchParams).setup === "1";
  if (!setup && !(await cookies()).has("yespiz-password-recovery")) redirect("/auth/forgot-password");
  return <AuthFlow initialStep={setup ? "password" : "reset"} />;
}
