"use client";

import { ScrollFade } from "@animate-ui/react/primitives/effects/scroll-fade";
import { PageTransitionShared } from "../../components/page-transition";
import Image from "next/image";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { MenuItem } from "./catalog";

export function PizzaPreview({ item, promo, children }: { item: MenuItem; promo: boolean; children: ReactNode }) {
  const t = useTranslations("Application.menu");
  const toppings = item.ingredients.filter(key => key !== "tomatoSauce" && key !== "pizzaDough");
  const [selected, setSelected] = useState<string[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const flight = useRef<{ key: string; from: DOMRect } | null>(null);

  useLayoutEffect(() => {
    const pending = flight.current;
    flight.current = null;
    if (!pending || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stage.current?.querySelectorAll<HTMLElement>(`[data-piece="${pending.key}"]`).forEach((piece, index) => {
      const to = piece.getBoundingClientRect();
      const x = pending.from.x + pending.from.width / 2 - to.x - to.width / 2;
      const y = pending.from.y + pending.from.height / 2 - to.y - to.height / 2;
      piece.animate([{ transform: `translate(${x}px,${y}px) scale(1.35)` }, { transform: "none" }],
        { duration: 550 + index * 45, easing: "cubic-bezier(.2,.75,.3,1)" });
    });
  }, [selected]);

  return <>
    <header className="dish-hero pizza-hero">
      <div aria-hidden="true" className="wordmark">{Array.from({ length: 6 }, (_, i) => <div key={i}>Yespiz Yespiz Yespiz Yespiz</div>)}</div>
      <div className="pizza-preview" ref={stage}>
        <PageTransitionShared name={`dish-${item.id}-photo`} style={{display:"block"}}><Image priority className="dish-photo" src={item.image} width={246} height={246} alt={t(item.key)} /></PageTransitionShared>
        {toppings.map((key, i) => selected.includes(key) && [0, 1, 2].map((n) => {
          const angle = n * 2 * Math.PI / 3 + i * 1.1;
          return <Image key={key+n} data-piece={key} alt="" src={`/menu/ingredients/${key}.webp`} width={36} height={36}
            style={{ left: (43 + Math.cos(angle) * 26) + "%", top: (43 + Math.sin(angle) * 24) + "%" }} />;
        }))}
      </div>
      {children}
    </header>
    {promo && "originalPrice" in item && <aside className="mx-(--page-gutter) mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4"><strong className="grow">{t("promo")}</strong><del className="text-muted">€{item.originalPrice}</del><b>€{item.price}</b></aside>}
    <section className="dish-ingredients"><h2>{t("toppings")}</h2>
      <ScrollFade asChild orientation="horizontal" size={18}><ul className="category-tiles topping-options">{toppings.map(key => <li key={key}>
        <button type="button" aria-pressed={selected.includes(key)} onClick={e => {
          flight.current = { key, from: e.currentTarget.querySelector("img")!.getBoundingClientRect() };
          setSelected(previous => previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key]);
        }}><Image src={`/menu/ingredients/${key}.webp`} width={48} height={48} alt="" />{t(key)}</button>
      </li>)}</ul></ScrollFade>
    </section>
  </>;
}
