"use client";

import { ArrowUpRight, Sparkle } from "@repo/icons";
import { Chip } from "@heroui/react";
import Image from "next/image";
import { ButtonLink } from "./components/button-link";
import { useFormatter, useTranslations } from "next-intl";
import { A11y, EffectCards, Keyboard, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { menu, type MenuItem } from "./menu/[id]/catalog";
import { useEffect, useState } from "react";
import { commerceApi } from "@/lib/commerce-client";
import "swiper/css";
import "swiper/css/effect-cards";
import "swiper/css/pagination";
import "./promo-card.css";

export function PromoCard({ item, active }: { item: MenuItem; active: boolean }) {
  const t = useTranslations("Application.home");
  const dish = useTranslations("Application.menu");
  const format = useFormatter();
  return <article className="promo-card" inert={!active}>
    <span className="promo-tab"><Sparkle aria-hidden="true" />{t("freshPicks")}</span>
    <div className="promo-copy">
      <h2><span>{dish(item.key)}</span><strong>{t("pizzaLove")}</strong></h2>
      <ul>{item.ingredients.slice(0, 3).map(key => <li key={key}><Chip size="sm">{dish(key)}</Chip></li>)}<li aria-label={dish(item.ingredients[3])}><Chip size="sm">+1</Chip></li></ul>
      <b>{format.number(item.price, { style: "currency", currency: "EUR" })}</b>
    </div>
    <Image className="promo-pizza" src={item.image} alt="" width={360} height={360} sizes="(max-width: 540px) 58vw, 290px" />
    <ButtonLink size="lg" className="promo-order" href={`/menu/${item.id}`}>{t("orderNow")} <ArrowUpRight size={16} /></ButtonLink>
  </article>;
}

const featured = [menu[1], menu[0], ...menu.slice(2)];
export function PromoDeck() {
  const t = useTranslations("Application.home");
  const [content, setContent] = useState<{ id: string; headline: string; description: string; href: string }[]>([]);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return;
    let active = true;
    commerceApi<typeof content>("content/home").then(items => { if (active) setContent(items); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (content.length) return <section aria-label={t("freshPicks")} className="promo-deck">
    <Swiper modules={[Pagination, Keyboard, A11y]} keyboard={{ enabled: true }} pagination={{ clickable: true }}>
      {content.map((item, index) => <SwiperSlide key={`${item.id}-${index}`}>
        <article className="promo-card"><div className="promo-copy"><h2>{item.headline}</h2>{item.description && <p>{item.description}</p>}</div>
          <ButtonLink size="lg" className="promo-order" href={item.href}>{t("orderNow")} <ArrowUpRight size={16} /></ButtonLink>
        </article>
      </SwiperSlide>)}
    </Swiper>
  </section>;
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return null;
  return <section aria-label={t("freshPicks")} className="promo-deck">
    <Swiper modules={[EffectCards, Pagination, Keyboard, A11y]} effect="cards"
      cardsEffect={{ slideShadows: false, perSlideOffset: 5, perSlideRotate: 2 }}
      keyboard={{ enabled: true }} pagination={{ clickable: true }} grabCursor rewind>
      {featured.map(item => <SwiperSlide key={item.id}>{({ isActive }) => <PromoCard item={item} active={isActive} />}</SwiperSlide>)}
    </Swiper>
  </section>;
}
