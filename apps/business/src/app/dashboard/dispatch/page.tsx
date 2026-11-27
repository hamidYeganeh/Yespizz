import { DispatchDashboard } from "../../../../../../packages/ui/src/dispatch-dashboard";
import { listOrders } from "../../../../../../packages/ui/src/order-store";
import "../../../../../../packages/ui/styles/dispatch.css";
import {restaurant} from "@/lib/profile";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function Dashboard(){
const {owner,profile,role}=await restaurant();
if (role === "kitchen") redirect("/dashboard/commerce");
return <DispatchDashboard title={profile.name||"Restaurant orders"} orders={listOrders(owner)} demo={false}/>
}

