import { notFound } from "next/navigation";
import { OrderTracking } from "./tracking";
import "./order.css";

import { Suspense } from "react";
import { OfflineOrder } from "./offline-order";
import { OnlineOrder } from "../online-order";
import "../../payment/checkout.css";

export const metadata = { referrer: "no-referrer" } as const;

export default async function OrderPage({
  params,
}: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1" && /^FIT[0-9a-f-]{36}$/i.test(orderId)) return <Suspense><OnlineOrder reference={orderId} /></Suspense>;
  if (orderId === "demo" && process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return <Suspense><OfflineOrder /></Suspense>;
  if (orderId !== "1" && !/^FIT\d{10}$/.test(orderId)) notFound();
  return <OrderTracking orderId={orderId} />;
}

export async function generateStaticParams() { return [{orderId:"1"}, {orderId:"demo"}]; }
