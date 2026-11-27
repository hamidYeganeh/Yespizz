"use client";

import { Button, Card, Modal, Tabs, TextArea } from "@heroui/react";
import { Bell, MapPin, Pizza, RotateCw } from "@repo/icons";
import Image from "next/image";
import { ButtonLink } from "../components/button-link";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { PageTransition } from "../components/page-transition";
import { FeedNavigation } from "../feed-navigation";
import { menu } from "../menu/[id]/catalog";
import { addConfiguredLine, readBasket } from "../payment/cart";
import { useProfileValue } from "../profile/profile-data";
import { orderHref } from "./order-href";
import { sampleOrders, type StoredOrder, type OrderStatus } from "./order-data";
import { commerceApi } from "@/lib/commerce-client";
import type { OnlineOrderData } from "./online-order";
import "../home.css";
import "./orders.css";

const tabs = ["active", "completed", "cancelled"] as const;
const offline = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("order-cancelled", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("order-cancelled", listener);
  };
}

export default function OrdersPage() {
  return <Suspense><OrdersFeed /></Suspense>;
}

function OrdersFeed() {
  const t = useTranslations("Application");
  const fmt = useFormatter();
  const router = useRouter();
  const query = useSearchParams();
  const tabParam = query.get("tab");
  const tab:OrderStatus = tabParam === "completed" || tabParam === "cancelled" ? tabParam : "active";
  function setTab(next:OrderStatus) {
    const url = new URL(location.href);
    if (next === "active") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }
  const [saved,,ready] = useProfileValue<StoredOrder[]>("orders", []);
  const [reviews, saveReviews] = useProfileValue<Record<string,string>>("order-reviews", {});
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [review, setReview] = useState("");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<StoredOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (offline) return;
    let running = true;
    const load = () => commerceApi<OnlineOrderData[]>("orders").then(data => {
      if (!running) return;
      setRemote(data.map(order => ({ reference: order.reference, date: order.date, total: order.total / 100,
        stage: order.stage, paymentMethod: order.paymentStatus, address: [order.address.line, order.address.city].filter(Boolean).join(", "),
        items: order.lines.reduce<Record<string, number>>((items, line) => ({ ...items, [line.id]: (items[line.id] ?? 0) + line.quantity }), {}),
        status: order.stage === "delivered" ? "completed" : ["cancelled", "rejected"].includes(order.stage) ? "cancelled" : "active" })));
      setLoaded(true);
    }).catch(error => { if (running) { setMessage(error.message); setLoaded(true); } });
    void load();
    const interval = setInterval(load, 12000);
    return () => { running = false; clearInterval(interval); };
  }, []);
  const orders = offline ? [...saved, ...sampleOrders] : remote;
  const cancelled = useSyncExternalStore(subscribe, () => orders.filter(o => localStorage.getItem("yespiz-cancelled-" + o.reference) === "yes").map(o => o.reference).join(","), () => "");
  const delivered = useSyncExternalStore(subscribe, () => orders.filter(o => localStorage.getItem("yespiz-delivered-" + o.reference) === "yes").map(o => o.reference).join(","), () => "");
  const visible = orders.filter(o => ((offline && cancelled.split(",").includes(o.reference)) ? "cancelled" : (offline && delivered.split(",").includes(o.reference)) ? "completed" : o.status ?? "active") === tab);
  async function reorder(order: StoredOrder) {
    const basket = readBasket();
    let entries = Object.entries(order.items ?? {});
    if (!offline) {
      try {
        const result = await commerceApi<{ lines: OnlineOrderData["lines"] }>(`orders/${encodeURIComponent(order.reference)}/reorder`, "POST", {});
        for (const line of result.lines) addConfiguredLine(line);
        entries = [];
      }
      catch (error) { setMessage(error instanceof Error ? error.message : "Could not repeat order."); return; }
    }
    for (const [id, quantity] of entries) {
      if (quantity > 0) basket[id] = (basket[id] ?? 0) + quantity;
    }
    localStorage.setItem("yespiz-basket", JSON.stringify(basket));
    window.dispatchEvent(new Event("storage"));
    router.push("/payment", { transitionTypes: ["slide"] });
  }
  async function confirm() {
    if (!reviewId) return;
    if (!offline) {
      try { await commerceApi(`orders/${encodeURIComponent(reviewId)}/review`, "POST", { text: review, rating }); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Review unavailable."); return; }
    }
    saveReviews({...reviews, [reviewId]: review.trim()});
    setReviewId(null);
  }
  return <PageTransition effect="slide"><main className="home-feed orders-feed">
    <header><Link href="/" className="orders-brand"><Image src="/profile/brand-mark.png" width={28} height={28} alt="" />Yespiz</Link>
      <h1 className="sr-only">{t("home.orders")}</h1><ButtonLink href="/notifications" className="home-bell" aria-label={t("home.notifications")}><Bell size={21} /></ButtonLink></header>
    {message && <p role="alert">{message}</p>}
    <Tabs selectedKey={tab} onSelectionChange={key => setTab(key as OrderStatus)}>
      <Tabs.ListContainer><Tabs.List aria-label={t("home.orders")} className="orders-tabs">
        {tabs.map(key => <Tabs.Tab key={key} id={key}>{t(`orderList.${key}`)}<Tabs.Indicator /></Tabs.Tab>)}
      </Tabs.List></Tabs.ListContainer>
      <Tabs.Panel key={tab} id={tab}><div className="orders-list">
        {(offline ? ready : loaded) && !visible.length && <div className="orders-empty"><Image src="/empty/orders.webp" alt="" width={180} height={177} /><h2>{t("orderList.empty")}</h2>
          <p>{t(({active:"orderList.emptyActive", completed:"orderList.emptyCompleted", cancelled:"orderList.emptyCancelled"} as const)[tab])}</p></div>}
        {(offline ? ready : loaded) && visible.map(order => {
          const lines = Object.entries(order.items ?? {}).filter(([,qty]) => qty > 0);
          const dish = menu.find(item => item.id === lines[0]?.[0]);
          const count = lines.reduce((sum,[,qty]) => sum + qty, 0);
          return <Card className="orders-card" key={order.reference}>
            <div className="orders-summary"><Image width={120} height={120} src={dish ? dish.image : "/orders/pizza.webp"} alt="" />
              <div className="orders-copy"><h2><Link href={orderHref(order.reference)}>{dish ? t(`menu.${dish.key}`) : order.reference}</Link></h2>
                <p>{count ? t("orderList.items",{count}) : fmt.dateTime(new Date(order.date))}{order.distance && " | " + fmt.number(order.distance) + " km"}</p>
                <div><b>{fmt.number(order.total,{style:"currency",currency:"EUR",maximumFractionDigits:2,minimumFractionDigits:0})}</b>
                  <span className="orders-status" data-status={tab}>{!offline && tab === "active" && order.paymentMethod !== "paid" ? "Payment pending" : t(`orderList.${tab === "active" ? "paid" : tab}`)}</span></div></div></div>
            {tab === "active" && <>{offline && <div className="orders-progress" aria-hidden="true"><Pizza size={18} /></div>}
              <div className="orders-actions">{(offline || ["received","accepted"].includes(order.stage ?? "")) && <Button variant="secondary" onPress={() => router.push(orderHref(order.reference, true), {transitionTypes:["slide"]})}>{t("orderList.cancel")}</Button>}
                <ButtonLink href={orderHref(order.reference)} transitionTypes={["slide"]}>{t("orderList.track")} <MapPin size={16} /></ButtonLink></div></>}
            {tab === "completed" && <div className="orders-actions"><Button variant="secondary" onPress={() => {if (!offline) { router.push("/orders/review?order=" + encodeURIComponent(order.reference)); return; } setReview(reviews[order.reference] ?? ""); setReviewId(order.reference);}}>{t(reviews[order.reference] ? "orderList.edit" : "orderList.review")}</Button>
              <Button className="orders-again" onPress={() => reorder(order)}>{t("orderList.again")} <RotateCw size={16} /></Button></div>}
          </Card>;
        })}
      </div></Tabs.Panel>
    </Tabs>
    <FeedNavigation current="orders" />
    <Modal.Backdrop isOpen={!!reviewId} onOpenChange={open => { if (!open) setReviewId(null); }} isDismissable><Modal.Container><Modal.Dialog>
      <Modal.Header><Modal.Heading>{t("orderList.review")}</Modal.Heading></Modal.Header>
      <Modal.Body>{!offline && <label>Rating<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label>}<TextArea aria-label={t("orderList.review")} value={review} onChange={e => setReview(e.target.value)} /></Modal.Body>
      <Modal.Footer><Button variant="secondary" onPress={() => setReviewId(null)}>{t("order.cancel")}</Button>
        <Button isDisabled={!review.trim()} onPress={confirm}>{t("orderList.save")}</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container></Modal.Backdrop>
  </main></PageTransition>;
}
