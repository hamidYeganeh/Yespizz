"use client";
import { BottomNavigation, BottomNavigationItem, BottomNavigationLabel } from "@animate-ui/react/primitives/bottom-navigation";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring, useShouldReduceMotion, useTempoTransition } from "@animate-ui/react/utils/motion";
import { readBasket } from "./payment/cart";
import { Icon } from "@repo/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";

function subscribeBasket(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("pageshow", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("pageshow", listener);
  };
}
const basketCount = () => Object.values(readBasket()).reduce((sum, n) => sum + n, 0);

export function FeedNavigation({ current }: { current: "home" | "orders" }) {
  const t = useTranslations("Application.home");
  const checkout = useTranslations("Application.checkout");
  const count = useSyncExternalStore(subscribeBasket, basketCount, () => 0);
  const reduced = useShouldReduceMotion();
  const pop = useTempoTransition(spring.pop);
  return <div className="feed-dock"><BottomNavigation className="home-nav" value={current} scrollBehavior="minimize" aria-label={t("navigation")}>
      {([["home","/","house-1"],["orders","/orders","shopping-bag"],["profile","/profile","user"]] as const).map(([key,href,icon])=>
        <BottomNavigationItem key={key} value={key} asChild><Link href={href} transitionTypes={["slide"]} aria-label={t(key)}><Icon name={icon}/><BottomNavigationLabel>{t(key)}</BottomNavigationLabel></Link></BottomNavigationItem>)}
    </BottomNavigation>
      <AnimatePresence>{count > 0 && <motion.div key="basket" initial={{opacity:0,scale:reduced ? 1 : .9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:reduced ? 1 : .9}} transition={pop}><Link className="feed-basket" href="/payment" transitionTypes={["slide"]} aria-label={checkout("title")+" · "+count}><Icon name="shopping-bag"/><b>{count}</b></Link></motion.div>}</AnimatePresence>
    </div>;
}
