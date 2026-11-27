import { notFound } from "next/navigation";
import { Studio } from "../../studio";
import { PasswordForm } from "../../../../../../packages/staff/password-form";
export default async function Page({params}:{params:Promise<{mode:string}>}) {
  const {mode} = await params;
  if (mode !== "sign-in" && mode !== "forgot-password") notFound();
  return <Studio scene={mode}><PasswordForm key={mode} role="business" initial={mode}/></Studio>;
}
