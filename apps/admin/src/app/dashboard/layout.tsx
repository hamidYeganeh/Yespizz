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
      <nav className="admin-toolbar" aria-label="Administration">
        <a href="/dashboard/commerce">Order administration</a>
        <a href="/dashboard/restaurants/new">
          Restaurant invitations
        </a>{" "}
        <Logout />
      </nav>
      {children}
    </>
  );
}
