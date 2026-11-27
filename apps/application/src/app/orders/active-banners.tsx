"use client";
import { Button, Card } from "@heroui/react";
import { MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useProfileValue } from "../profile/profile-data";
import { sampleOrders, type StoredOrder } from "./order-data";
import { orderHref } from "./order-href";
import Link from "next/link";
import { commerceApi } from "@/lib/commerce-client";
import type { OnlineOrderData } from "./online-order";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("order-cancelled", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("order-cancelled", listener);
  };
}
function Banner({ order }: { order: StoredOrder }) {
  const t = useTranslations("Application"),
    fmt = useFormatter();
  const [open, setOpen] = useState(false);
  const active = useSyncExternalStore(
    subscribe,
    () =>
      localStorage.getItem("yespiz-cancelled-" + order.reference) !== "yes" &&
      localStorage.getItem("yespiz-delivered-" + order.reference) !== "yes",
    () => false,
  );
  if (!active) return null;
  return (
    <Card className="my-3 grid gap-3 rounded-3xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong>
            {t("orderList.active")} · #{order.reference}
          </strong>
          <p>
            {t("orderList.items", {
              count: Object.values(order.items ?? {}).reduce(
                (sum, n) => sum + n,
                0,
              ),
            })}{" "}
            · {fmt.number(order.total, { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <Button
          variant="secondary"
          aria-expanded={open}
          onPress={() => setOpen(!open)}
        >
          {open ? <X size={18} /> : <MapPin size={18} />}{" "}
          {t(open ? "checkout.close" : "settings.viewMap")}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <iframe
              title={t("order.tracking")}
              className="h-52 w-full rounded-2xl"
              src={
                "https://maps.google.com/maps?q=" +
                encodeURIComponent(
                  order.point
                    ? order.point.lat + "," + order.point.lng
                    : order.address || "52.370813,4.883026",
                ) +
                "&z=15&output=embed"
              }
            />
            <Link href={orderHref(order.reference)}>
              {t("orderList.track")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
export function ActiveOrders() {
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return <LiveActiveOrders />;
  return <DemoActiveOrders />;
}

function LiveActiveOrders() {
  const t = useTranslations("Application.orderList");
  const format = useFormatter();
  const [orders, setOrders] = useState<OnlineOrderData[]>([]);
  useEffect(() => {
    let live = true;
    const refresh = () => commerceApi<OnlineOrderData[]>("orders").then(items => {
      if (live) setOrders(items.filter(order => !["delivered", "cancelled", "rejected", "pending_payment"].includes(order.stage)));
    }).catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  return orders.map(order => <Card key={order.reference} className="my-3 grid gap-3 rounded-3xl p-4"><Card.Content>
    <strong>{t("active")} · {order.reference}</strong><p>{format.number(order.total / 100, { style: "currency", currency: "EUR" })}</p>
    <Link href={orderHref(order.reference)}>{t("track")}</Link>
  </Card.Content></Card>);
}

function DemoActiveOrders() {
  const [orders, , ready] = useProfileValue<StoredOrder[]>("orders", []);
  return (
    ready &&
    [...orders, ...sampleOrders]
      .filter((o) => (o.status ?? "active") === "active")
      .map((o) => <Banner key={o.reference} order={o} />)
  );
}
