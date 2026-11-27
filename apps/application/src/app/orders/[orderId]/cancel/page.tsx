import { CancelOrder } from "./cancel-order";

import { Suspense } from "react";
import { OfflineOrder } from "../offline-order";
import { OnlineOrder } from "../../online-order";
import "../../../payment/checkout.css";

export const metadata = { referrer: "no-referrer" } as const;

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1" && /^FIT[0-9a-f-]{36}$/i.test(orderId)) return <Suspense><OnlineOrder reference={orderId} cancel /></Suspense>;
  if (orderId === "demo" && process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return <Suspense><OfflineOrder cancel /></Suspense>;
  return <CancelOrder orderId={orderId} />;
}

export async function generateStaticParams() { return [{orderId:"1"}, {orderId:"demo"}]; }
