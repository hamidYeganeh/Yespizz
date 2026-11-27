"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, MapPin, Check, ShoppingBag, Star } from "@repo/icons";
import { BackLink } from "../components/back-link";
import { menu } from "../menu/[id]/catalog";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input } from "@heroui/react";
import { useFormatter, useLocale } from "next-intl";
import { commerceApi } from "@/lib/commerce-client";
import { configuredBasketKey } from "../payment/cart";

export type OnlineOrderData = {
  reference: string; date: string; stage: string; paymentStatus: string; total: number;
  address: { line: string; unit?: string; city: string; postalCode: string; point?: { lat: number; lng: number } };
  lines: { id: string; name: string; quantity: number; unitPrice: number; size?: string; toppings: string[]; removed: string[] }[];
  etaMinutes: number; scheduledAt?: string; estimatedAt?: string;
  events: { stage: string; at: string; reason?: string }[];
  courierLocation?: { lat: number; lng: number; at: string };
};

const labels: Record<string, [string, string]> = {
  pending_payment: ["Awaiting payment", "Zahlung ausständig"], received: ["Order received", "Bestellung eingegangen"],
  accepted: ["Accepted", "Angenommen"], preparing: ["Preparing", "In Vorbereitung"], ready: ["Ready", "Bereit"],
  out_for_delivery: ["Out for delivery", "Unterwegs"], delivered: ["Delivered", "Zugestellt"], rejected: ["Declined", "Abgelehnt"],
  cancelled: ["Cancelled", "Storniert"], paid: ["Paid", "Bezahlt"], failed: ["Payment failed", "Zahlung fehlgeschlagen"],
  pending: ["Payment pending", "Zahlung ausständig"], refund_pending: ["Refund pending", "Rückerstattung ausständig"],
  refunded: ["Refunded", "Rückerstattet"], refund_failed: ["Refund requires attention", "Rückerstattung muss geprüft werden"],
};

export function OnlineOrder({ reference, cancel = false }: { reference: string; cancel?: boolean }) {
  const params = useSearchParams();
  const access = params.get("access") ?? "";
  const suffix = access ? `?access=${encodeURIComponent(access)}` : "";
  const path = `orders/${encodeURIComponent(reference)}`;
  const [order, setOrder] = useState<OnlineOrderData | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const german = useLocale().startsWith("de");
  const fmt = useFormatter();
  const name = (value: string) => labels[value]?.[german ? 1 : 0] ?? value;
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const value = await commerceApi<OnlineOrderData>(`${path}/tracking${suffix}`);
        if (!live) return;
        setOrder(value);
        setError("");
        if (value.paymentStatus === "paid") {
          const key = `yespizz-checkout-${value.reference}`;
          const basket = sessionStorage.getItem(key);
          const current = JSON.stringify([localStorage.getItem("yespiz-basket") ?? "{}", localStorage.getItem(configuredBasketKey) ?? "[]"]);
          if (basket && basket === current) {
            localStorage.removeItem("yespiz-basket");
            localStorage.removeItem(configuredBasketKey);
            window.dispatchEvent(new Event("storage"));
            void commerceApi("me/cart", "PUT", { value: { simple: {}, configured: [] } }).catch(() => {});
          }
          sessionStorage.removeItem(key);
          const orderKey = sessionStorage.getItem(`yespizz-checkout-key-${value.reference}`);
          if (orderKey) {
            sessionStorage.removeItem(`yespizz-open-checkout-${orderKey}`);
            sessionStorage.removeItem(`yespizz-checkout-key-${value.reference}`);
          }
        }
      } catch (failure) {
        if (live) setError(failure instanceof Error ? failure.message : "Order unavailable.");
      }
    }
    void load();
    const interval = setInterval(load, 7000);
    return () => { live = false; clearInterval(interval); };
  }, [path, suffix, refresh]);

  async function action(type: "cancel" | "payment") {
    setBusy(true);
    setActionError("");
    try {
      if (type === "cancel") setOrder(await commerceApi<OnlineOrderData>(`${path}/cancel${suffix}`, "POST", { reason }));
      else {
        const result = await commerceApi<{ url: string | null }>(`${path}/payment${suffix}`, "POST", {});
        if (result.url) window.location.assign(result.url);
        else setRefresh(value => value + 1);
      }
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : "The request could not be completed."); }
    finally { setBusy(false); }
  }

  const cancellable = order && ["received", "accepted"].includes(order.stage);
  const estimated = order?.estimatedAt ?? order?.scheduledAt ?? (order ? new Date(Date.parse(order.date) + order.etaMinutes * 60000).toISOString() : undefined);
  const dish = menu.find(item => item.id === order?.lines[0]?.id);
  return <main className="checkout order-receipt live-receipt">
    <header><BackLink href="/orders" aria-label={german ? "Bestellungen" : "Orders"}><ChevronLeft/></BackLink><h1>{german ? "Bestelldetails" : "Order details"}</h1></header>
    <Card className="checkout-card">
      <Card.Content>

        {error && <p role="alert">{error}</p>}
        {!order && !error && <p role="status">{german ? "Bestellung wird geladen …" : "Loading order…"}</p>}
        {order && <>
          <section className="receipt-hero"><div><span className="receipt-payment">{order.paymentStatus === "paid" ? <Check/> : <ShoppingBag/>}{name(order.paymentStatus)}</span><h2 role="status">{name(order.stage)}</h2><time dateTime={order.date}>{fmt.dateTime(new Date(order.date), {dateStyle:"medium", timeZone:"Europe/Vienna"})}</time></div>{dish && <Image src={dish.image} width={140} height={140} alt=""/>}</section>
          {estimated && !["delivered", "cancelled", "rejected"].includes(order.stage) && <p>{german ? "Voraussichtlich" : "Estimated delivery"} {fmt.dateTime(new Date(estimated), { timeZone: "Europe/Vienna", dateStyle: "medium", timeStyle: "short" })}</p>}
          <div className="receipt-address"><MapPin/><div><small>{german ? "Lieferadresse" : "Delivery address"}</small><p>{[order.address.line, order.address.unit, order.address.postalCode, order.address.city].filter(Boolean).join(", ")}</p></div></div>
          <section className="receipt-items"><h2>{german ? "Bestellübersicht" : "Order summary"}</h2><ul>{order.lines.map((line, index) => <li key={`${line.id}-${index}`}>{line.quantity} × {line.name}{line.size && ` · ${line.size}`}{line.toppings.length > 0 && ` · +${line.toppings.join(", ")}`}{line.removed.length > 0 && ` · −${line.removed.join(", ")}`}</li>)}</ul>
          <p className="receipt-total"><span>{german ? "Gesamt" : "Total"}</span><strong>{fmt.number(order.total / 100, { style: "currency", currency: "EUR" })}</strong></p></section>
          <details className="receipt-history" open={order.stage !== "delivered"}><summary>{german ? "Verlauf" : "Order timeline"}</summary><ol className="receipt-events">{order.events.map((event, index) => <li key={index}><strong>{name(event.stage)}</strong><time dateTime={event.at}>{fmt.dateTime(new Date(event.at), { timeZone: "Europe/Vienna", timeStyle: "short" })}</time>{event.reason && ` · ${event.reason}`}</li>)}</ol></details>
          {order.courierLocation && order.stage === "out_for_delivery" && <p>
            <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${order.courierLocation.lat}&mlon=${order.courierLocation.lng}#map=16/${order.courierLocation.lat}/${order.courierLocation.lng}`}>
              {german ? "Letzte Standortmeldung" : "Last courier update"} {fmt.dateTime(new Date(order.courierLocation.at), { timeZone: "Europe/Vienna", timeStyle: "short" })}
            </a></p>}
          {order.stage === "delivered" && <Link className="receipt-review-action" href={`/orders/review?order=${encodeURIComponent(reference)}${access ? "&access=" + encodeURIComponent(access) : ""}`}><Star/>{german ? "Bestellung bewerten" : "Review your order"}</Link>}
          {actionError && <p role="alert">{actionError}</p>}
          {order.stage === "pending_payment" && <Button isDisabled={busy} onPress={() => void action("payment")}>{german ? "Zahlung fortsetzen" : "Resume payment"}</Button>}
          {cancellable && (cancel ? <><label>{german ? "Grund" : "Reason"}<Input value={reason} onChange={event => setReason(event.target.value)} /></label>
            <Button variant="danger" isDisabled={busy} onPress={() => void action("cancel")}>{german ? "Bestellung stornieren" : "Cancel order"}</Button></>
            : <Link href={`/${path}/cancel${suffix}`}>{german ? "Stornieren" : "Cancel order"}</Link>)}
          <small className="receipt-reference">{reference}</small><p><Link href={`/profile/help/chat?order=${encodeURIComponent(reference)}${access ? `&access=${encodeURIComponent(access)}` : ""}`}>{german ? "Hilfe zur Bestellung" : "Get help with this order"}</Link></p>
        </>}
      </Card.Content>
    </Card>
  </main>;
}
