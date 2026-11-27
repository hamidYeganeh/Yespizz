"use client";

import { Button, Card } from "@heroui/react";
import { Heart } from "lucide-react";
import { Icon } from "@repo/icons";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { PageTransitionShared } from "../components/page-transition";
import type { MenuItem } from "./[id]/catalog";
import { useSavedDish } from "./use-saved-dish";
import "./menu-card.css";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-menu-pending="" /> : null;
}

export function MenuCard({ item, vertical = false, hideSave = false, basket }: { item: Omit<MenuItem, "price"> & { price: number }; vertical?: boolean; hideSave?: boolean; basket?: { quantity:number; controls:ReactNode } }) {
  const t = useTranslations("Application.menu");
  const format = useFormatter();
  const [saved, toggle] = useSavedDish(item.id);
  const instance = useId().replace(/[^a-z0-9]/gi, "");
  const [opening, setOpening] = useState(false);
  // The same dish can appear twice on Home. Only the activated card shares the hero names.
  const prefix = opening ? "dish-" + item.id : "card-" + instance;
  if (basket) {
    return <Card className="basket-product">
      <Link className="basket-product-photo" transitionTypes={["slide"]} href={"/menu/"+item.id} aria-label={t(item.key)}>
        <PendingNavigation />
        {Array.from({length: Math.min(3,basket.quantity)}, (_,index) =>
          <Image key={index} src={item.image} width={120} height={120} sizes="96px" alt="" />)}
      </Link>
      <div className="basket-product-copy">
        <Link href={"/menu/"+item.id} className="font-bold"><PendingNavigation />{t(item.key)}</Link>
        <div className="basket-product-actions">
          <strong>{format.number(item.price,{style:"currency",currency:"EUR", minimumFractionDigits:0})}</strong>
          {basket.controls}
        </div>
      </div>
    </Card>;
  }
  return <Card className={"menu-card " + (vertical ? "menu-card-tall" : "menu-card-wide")}>
    <Link className="menu-card-link" href={"/menu/" + item.id} aria-label={t(item.key)}
      onNavigate={() => flushSync(() => setOpening(true))} transitionTypes={["slide"]}>
      <PendingNavigation />
      <PageTransitionShared name={prefix + "-photo"} className="menu-card-photo">
        <Image src={item.image} width={280} height={280} sizes={vertical ? "(max-width: 544px) 42vw, 220px" : "108px"} alt="" />
      </PageTransitionShared>
      <Card.Content className="menu-card-copy">
        <strong><PageTransitionShared name={prefix + "-name"}>{t(item.key)}</PageTransitionShared></strong>
        <p>{t(`${item.key}Short`)}</p>
        <b>{format.number(item.price,{style:"currency",currency:"EUR"})}</b>
      </Card.Content>
      <span aria-hidden="true" className="menu-card-bag"><Icon name="shopping-bag" /></span>
    </Link>
    {!hideSave && <Button className="menu-card-save" isIconOnly size="lg" variant="secondary" aria-label={t("favorite")+" · "+t(item.key)} aria-pressed={saved} onPress={toggle}>
      <Heart aria-hidden="true" size={20} fill={saved ? "currentColor" : "none"} />
    </Button>}
  </Card>;
}
