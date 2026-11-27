import { CancelOrder } from "./cancel-order";

import { Suspense } from "react";
import { OfflineOrder } from "../offline-order";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (orderId === "demo" && process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return <Suspense><OfflineOrder cancel /></Suspense>;
  return <CancelOrder orderId={orderId} />;
}

export async function generateStaticParams() { return [{orderId:"1"}, {orderId:"demo"}]; }
