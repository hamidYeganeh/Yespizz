import { DispatchDashboard } from "../../../../../../packages/ui/src/dispatch-dashboard";
import { listOrders } from "../../../../../../packages/ui/src/order-store";
import "../../../../../../packages/ui/styles/dispatch.css";
import {signedIn} from "../../admin-session";
export const dynamic="force-dynamic";
export default async function Dashboard(){
const allowed=await signedIn();
return <DispatchDashboard title={"Order operations"} orders={allowed?listOrders():[]} demo={!allowed}/>
}

