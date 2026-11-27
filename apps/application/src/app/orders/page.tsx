"use client";

import { Button, Card, Modal, Tabs, TextArea } from "@heroui/react";
import { Bell, MapPin, Pizza, RotateCw } from "@repo/icons";
import Image from "next/image";
import { ButtonLink } from "../components/button-link";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense, useState, useSyncExternalStore } from "react";
import { PageTransition } from "../components/page-transition";
import { FeedNavigation } from "../feed-navigation";
import { menu } from "../menu/[id]/catalog";
import { readBasket } from "../payment/cart";
import { useProfileValue } from "../profile/profile-data";
import { orderHref } from "./order-href";
import { sampleOrders, type StoredOrder, type OrderStatus } from "./order-data";
import "../home.css";
import "./orders.css";

const tabs = ["active", "completed", "cancelled"] as const;
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
  const orders = [...saved, ...sampleOrders];
  const cancelled = useSyncExternalStore(subscribe, () => orders.filter(o => localStorage.getItem("yespiz-cancelled-" + o.reference) === "yes").map(o => o.reference).join(","), () => "");
  const delivered = useSyncExternalStore(subscribe, () => orders.filter(o => localStorage.getItem("yespiz-delivered-" + o.reference) === "yes").map(o => o.reference).join(","), () => "");
  const visible = orders.filter(o => (cancelled.split(",").includes(o.reference) ? "cancelled" : delivered.split(",").includes(o.reference) ? "completed" : o.status ?? "active") === tab);
  function reorder(order: StoredOrder) {
    const basket = readBasket();
    for (const [id, quantity] of Object.entries(order.items ?? {})) {
      if (quantity > 0) basket[id] = (basket[id] ?? 0) + quantity;
    }
    localStorage.setItem("yespiz-basket", JSON.stringify(basket));
    window.dispatchEvent(new Event("storage"));
    router.push("/payment", { transitionTypes: ["slide"] });
  }
  function confirm() {
    if (!reviewId) return;
    saveReviews({...reviews, [reviewId]: review.trim()});
    setReviewId(null);
  }
  return <PageTransition effect="slide"><main className="home-feed orders-feed">
    <header><Link href="/" className="orders-brand"><Image src="/profile/brand-mark.png" width={28} height={28} alt="" />Yespiz</Link>
      <h1 className="sr-only">{t("home.orders")}</h1><ButtonLink href="/notifications" className="home-bell" aria-label={t("home.notifications")}><Bell size={21} /></ButtonLink></header>
    <Tabs selectedKey={tab} onSelectionChange={key => setTab(key as OrderStatus)}>
      <Tabs.ListContainer><Tabs.List aria-label={t("home.orders")} className="orders-tabs">
        {tabs.map(key => <Tabs.Tab key={key} id={key}>{t(`orderList.${key}`)}<Tabs.Indicator /></Tabs.Tab>)}
      </Tabs.List></Tabs.ListContainer>
      <Tabs.Panel key={tab} id={tab}><div className="orders-list">
        {ready && !visible.length && <div className="orders-empty"><Image src="/empty/orders.webp" alt="" width={180} height={177} /><h2>{t("orderList.empty")}</h2>
          <p>{t(({active:"orderList.emptyActive", completed:"orderList.emptyCompleted", cancelled:"orderList.emptyCancelled"} as const)[tab])}</p></div>}
        {ready && visible.map(order => {
          const lines = Object.entries(order.items ?? {}).filter(([,qty]) => qty > 0);
          const dish = menu.find(item => item.id === lines[0]?.[0]);
          const count = lines.reduce((sum,[,qty]) => sum + qty, 0);
          return <Card className="orders-card" key={order.reference}>
            <div className="orders-summary"><Image width={120} height={120} src={dish ? dish.image : "/orders/pizza.webp"} alt="" />
              <div className="orders-copy"><h2>{dish ? t(`menu.${dish.key}`) : order.reference}</h2>
                <p>{count ? t("orderList.items",{count}) : fmt.dateTime(new Date(order.date))}{order.distance && " | " + fmt.number(order.distance) + " km"}</p>
                <div><b>{fmt.number(order.total,{style:"currency",currency:"EUR",maximumFractionDigits:2,minimumFractionDigits:0})}</b>
                  <span className="orders-status" data-status={tab}>{t(`orderList.${tab === "active" ? "paid" : tab}`)}</span></div></div></div>
            {tab === "active" && <><div className="orders-progress" aria-hidden="true"><Pizza size={18} /></div>
              <div className="orders-actions"><Button variant="secondary" onPress={() => router.push(orderHref(order.reference, true), {transitionTypes:["slide"]})}>{t("orderList.cancel")}</Button>
                <ButtonLink href={orderHref(order.reference)} transitionTypes={["slide"]}>{t("orderList.track")} <MapPin size={16} /></ButtonLink></div></>}
            {tab === "completed" && <div className="orders-actions"><Button variant="secondary" onPress={() => {setReview(reviews[order.reference] ?? ""); setReviewId(order.reference);}}>{t(reviews[order.reference] ? "orderList.edit" : "orderList.review")}</Button>
              <Button className="orders-again" onPress={() => reorder(order)}>{t("orderList.again")} <RotateCw size={16} /></Button></div>}
          </Card>;
        })}
      </div></Tabs.Panel>
    </Tabs>
    <FeedNavigation current="orders" />
    <Modal.Backdrop isOpen={!!reviewId} onOpenChange={open => { if (!open) setReviewId(null); }} isDismissable><Modal.Container><Modal.Dialog>
      <Modal.Header><Modal.Heading>{t("orderList.review")}</Modal.Heading></Modal.Header>
      <Modal.Body><TextArea aria-label={t("orderList.review")} value={review} onChange={e => setReview(e.target.value)} /></Modal.Body>
      <Modal.Footer><Button variant="secondary" onPress={() => setReviewId(null)}>{t("order.cancel")}</Button>
        <Button isDisabled={!review.trim()} onPress={confirm}>{t("orderList.save")}</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container></Modal.Backdrop>
  </main></PageTransition>;
}
