"use client";

import { useSearchParams } from "next/navigation";
import { OrderTracking } from "./tracking";
import { CancelOrder } from "./cancel/cancel-order";

export function OfflineOrder({ cancel = false }: { cancel?: boolean }) {
  const reference = useSearchParams().get("ref") || "1";
  if (reference !== "1" && !/^FIT\d{10}$/.test(reference)) return <p>Order unavailable.</p>;
  return cancel ? <CancelOrder orderId={reference} /> : <OrderTracking orderId={reference} />;
}
