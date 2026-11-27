"use client";

import { ActiveOrders } from "./orders/active-banners";
import { HomeAddresses } from "./home-addresses";
import { FeedNavigation } from "./feed-navigation";
import { SearchField } from "@heroui/react";
import { Icon } from "@repo/icons";
import Image from "next/image";
import { ButtonLink } from "./components/button-link";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { menu } from "./menu/[id]/catalog";

import { MenuCard } from "./menu/menu-card";
import { useLiveCatalog } from "./menu/live-catalog";
import { PromoDeck } from "./promo-card";
import { ProgressiveBlur } from "./menu/[id]/progressive-blur";
import "./home.css";

export function HomeFeed() {
  const t = useTranslations("Application.home");
  const dish = useTranslations("Application.menu");
  const live = useLiveCatalog();
  const offline = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1";
  const available = offline ? [...menu] : (live ?? []).flatMap(entry => {
    const presentation = menu.find(item => item.id === entry.id);
    return entry.available && presentation ? [{ ...presentation, price: entry.price / 100 }] : [];
  });
  const recommended = offline ? [...available].sort((a, b) => b.rating - a.rating).slice(0, 4) : [];
  return <main className="home-feed">
    <header><h1><Image src="/auth/wordmark.png" alt="Yespiz" width={90} height={30} /></h1><HomeAddresses/>
      <div className="flex items-center gap-2"><ButtonLink className="home-bell" href="/notifications" aria-label={t("notifications")}><Icon name="bell-1" /></ButtonLink></div></header>
    <div className="home-search">
      <div inert><SearchField aria-label={t("search")} variant="secondary" isReadOnly>
        <SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder={t("search")} /></SearchField.Group>
      </SearchField></div>
      <Link className="home-search-open" href="/menu?search=true" aria-label={t("search")} transitionTypes={["slide"]} />
    </div>
    <ActiveOrders/>
    <PromoDeck />
    <section><header><h2>{dish("menuTitle")}</h2><ButtonLink href="/menu">{dish("seeAll")}</ButtonLink></header>
      {available.length > 0 && <div className="home-deals">{available.map(item => <MenuCard hideSave vertical key={item.id} item={item}/>)}</div>}</section>
    {recommended.length > 0 && <section><header><h2>{dish("recommend")}</h2><ButtonLink href="/menu?recommended=true">{dish("seeAll")}</ButtonLink></header>
      <div className="home-recommend">{recommended.map(item => <MenuCard hideSave key={item.id} item={item}/>)}</div></section>}
    <div className="home-nav-backdrop"><ProgressiveBlur direction="bottom" /></div>
    <FeedNavigation current="home" />
  </main>;
}

