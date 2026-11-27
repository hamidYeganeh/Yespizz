import { redirect } from "next/navigation";
import { DispatchDashboard } from "../../../../../../packages/ui/src/dispatch-dashboard";
import { listOrders } from "../../../../../../packages/ui/src/order-store";
import "../../../../../../packages/ui/styles/dispatch.css";
import { signedIn } from "../../admin-session";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!(await signedIn())) redirect("/");
  return <DispatchDashboard title="Order operations" orders={listOrders()} />;
}
