import { Logout } from "./logout";
import { redirect } from "next/navigation";
import { signedIn } from "../admin-session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await signedIn())) redirect("/");
  return (
    <>
      <nav>
        <a href="/dashboard/restaurants/new">
          Create restaurant or resend invitation
        </a>{" "}
        · <Logout />
      </nav>
      {children}
    </>
  );
}
