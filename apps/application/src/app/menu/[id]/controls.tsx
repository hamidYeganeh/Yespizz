"use client";

import { Children, isValidElement } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard } from "swiper/modules";
import "swiper/css";
import { MenuCard } from "../menu-card";
import { useSavedDish } from "../use-saved-dish";
import { RollingCounter } from "../../components/rolling-counter";
import { Like } from "../../components/Like";
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@repo/icons";
import { ButtonLink } from "../../components/button-link";
import { BackLink } from "../../components/back-link";
import { useRouter } from "next/navigation";
import { readBasket } from "../../payment/cart";
import { BottomNavigation } from "@animate-ui/react/primitives/bottom-navigation";
import { Button as PressButton } from "@animate-ui/react/primitives/buttons/button";
import {
  ReducedMotionConfig,
  spring,
  transition,
  useTempoTransition,
  useShouldReduceMotion,
} from "@animate-ui/react/utils/motion";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { menu, type MenuItem } from "./catalog";

import { ProgressiveBlur } from "./progressive-blur";
import { useLiveCatalog } from "../live-catalog";

export function DishCarousel({label, children}: {label:string; children:ReactNode}) {
  return <Swiper className="dish-carousel" aria-label={label} modules={[A11y,Keyboard]} keyboard={{enabled:true}} slidesPerView="auto" spaceBetween={12} watchOverflow>
    {Children.toArray(children).map(child => <SwiperSlide key={isValidElement(child) ? child.key : String(child)}>{child}</SwiperSlide>)}
  </Swiper>;
}

export function Recommendation({ currentId }: { currentId: string }) {
  const t = useTranslations("Application.menu");
  const live = useLiveCatalog();
  const offline = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1";
  const items = offline ? menu.filter(item => item.id !== currentId) : (live ?? []).flatMap(entry => {
    const presentation = menu.find(item => item.id === entry.id);
    return entry.available && entry.id !== currentId && presentation
      ? [{ ...presentation, price: entry.price / 100 }]
      : [];
  });
  if (!items.length) return null;
  return (
    <section className="recommendations">
      <header>
        <h2>{t("recommend")}</h2>
        <ButtonLink href="/menu?recommended=true">{t("seeAll")}</ButtonLink>
      </header>
      <DishCarousel label={t("recommend")}>
        {items.slice(0, 5).map(item => <MenuCard key={item.id} item={item} hideSave />)}
      </DishCarousel>
    </section>
  );
}

export function OrderControls({
  item,
  children,
}: {
  item: MenuItem;
  children: ReactNode;
}) {
  const t = useTranslations("Application.menu");
  const backLabel = useTranslations("Application.profile")("back");
  const [saved, toggleSaved] = useSavedDish(item.id);
  const [quantity, setQuantity] = useState(0);
  const liveItem = useLiveCatalog()?.find(entry => entry.id === item.id);
  const price = liveItem ? liveItem.price / 100 : item.price;
  const router = useRouter();
  const navigating = useRef(false);
  const buy = useRef<HTMLButtonElement>(null);
  const morph = useTempoTransition(spring.morph);
  const reduce = useShouldReduceMotion();
  const swap = useTempoTransition(transition.swap);
  function openBasket() {
    if (navigating.current) return;
    const next = readBasket();
    next[item.id] = (next[item.id] || 0) + quantity;
    localStorage.setItem("yespiz-basket", JSON.stringify(next));
    navigating.current = true;
    router.push("/payment");
  }
  return (
    <main className="dish">
      <nav className="dish-toolbar">
        <ProgressiveBlur direction="top" />
        <BackLink href="/" parents={["/menu", "/profile/favorites", "/payment", ...menu.filter(entry => entry.id !== item.id).map(entry => "/menu/" + entry.id)]} className="dish-back" aria-label={backLabel}>
          <Icon name="chevron-left" />
        </BackLink>
        <Like liked={saved} onToggle={toggleSaved} label={t("saveDish")} />
      </nav>
      {children}
      <ReducedMotionConfig>
        <BottomNavigation layoutRoot className="order-anchor" aria-label={t("buy")}>
          <ProgressiveBlur direction="bottom" />
          <motion.div initial={false}
            transition={reduce ? { duration: 0 } : morph} className={quantity ? "order expanded" : "order"}
            style={{ borderRadius: 32 }}>
            <AnimatePresence initial={false}>
              {quantity > 0 && (
                <motion.div key="details" className="order-reveal"
                  initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { ...morph, opacity: swap }}>
                  <div className="order-details">
                  <div className="total">
                    <small>{t("total")}</small>
                    <strong>€<SlidingNumber number={quantity * price} initiallyStable /></strong>
                  </div>
                  <RollingCounter start={quantity} value={quantity} lessLabel={t("decrease")} moreLabel={t("increase")}
                    label={t("quantity")} onChange={next => {
                      if (!next) buy.current?.focus();
                      setQuantity(next);
                    }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <PressButton style={{ borderRadius: 26 }} ref={buy} aria-expanded={quantity > 0} disabled={liveItem?.available === false} className="buy"
              onClick={() => quantity ? openBasket() : setQuantity(1)}>
              <Icon name={quantity ? "shopping-bag" : "plus"} />
              {t("buy")}
              <AnimatePresence initial={false}>{!quantity && <motion.strong initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={reduce ? {duration: 0} : morph}>€{price}</motion.strong>}</AnimatePresence>
            </PressButton>
          </motion.div>
        </BottomNavigation>
      </ReducedMotionConfig>
    </main>
  );
}
