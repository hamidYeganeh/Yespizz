"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@heroui/react/button";
import { Button as PressButton } from "@animate-ui/react/primitives/buttons/button";
import {
  ReducedMotionConfig,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { menu, type MenuItem } from "./catalog";

function ProgressiveBlur({ direction }: { direction: "top" | "bottom" }) {
  const layers = 8;
  return (
    <div aria-hidden="true" className="edge-blur">
      {Array.from({ length: layers }, (_, index) => {
        const stops = [0, 1, 2, 3].map((offset) => {
          const color = offset === 1 || offset === 2 ? "black" : "transparent";
          return `${color} ${((index + offset) / (layers + 1)) * 100}%`;
        });
        const mask = `linear-gradient(to ${direction}, ${stops.join(", ")})`;
        const filter = `blur(${index * 0.25}px)`;
        return (
          <div
            key={index}
            style={{
              maskImage: mask,
              WebkitMaskImage: mask,
              backdropFilter: filter,
              WebkitBackdropFilter: filter,
            }}
          />
        );
      })}
    </div>
  );
}

function BasketIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 10 2.5 10h13L21 10M1 9h22M5 9l4-6m10 6-4-6m-5 12h4" />
    </svg>
  );
}

export function Recommendation({ item }: { item: MenuItem }) {
  const t = useTranslations("Application.menu");
  const [saved, setSaved] = useState(false);
  const [all, setAll] = useState(false);
  return (
    <section className="recommendations">
      <header>
        <h2>{t("recommend")} 😍</h2>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setAll(!all)}
          aria-expanded={all}
        >
          {t(all ? "less" : "seeAll")}
        </Button>
      </header>
      {(all
        ? [item, ...menu.filter((entry) => entry.id !== item.id)]
        : [item]
      ).map((entry) => (
        <div key={entry.id} className="recommendation">
          <Link href={`/menu/${entry.id}`}>
            <Image src={entry.image} width={118} height={118} alt="" />
            <div>
              <b>{t(entry.key)}</b>
              <span>
                <i>★</i> {entry.rating}（{entry.ratings}）
              </span>
              <strong>€{entry.price}</strong>
            </div>
          </Link>
          {entry.id === item.id && (
            <>
              <small>{t("promo")}</small>
              <Button
                size="sm"
                isIconOnly
                variant="secondary"
                className="favorite"
                aria-label={t("favorite")}
                aria-pressed={saved}
                onPress={() => setSaved(!saved)}
              >
                {saved ? "♥" : "♡"}
              </Button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

type Basket = Record<string, number>;
function readBasket(): Basket {
  try {
    const stored = JSON.parse(localStorage.getItem("yespiz-basket") || "{}");
    return Object.fromEntries(
      menu.map(({ id }) => [
        id,
        Number.isSafeInteger(stored?.[id]) && stored[id] > 0 ? stored[id] : 0,
      ]),
    );
  } catch {
    return {};
  }
}

export function OrderControls({ item }: { item: MenuItem }) {
  const t = useTranslations("Application.menu");
  const [quantity, setQuantity] = useState(0);
  const [basket, setBasket] = useState<Basket>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const buy = useRef<HTMLButtonElement>(null);
  const morph = useTempoTransition(spring.morph);
  const swap = useTempoTransition(transition.swap);
  function openBasket(add: boolean) {
    const next = readBasket();
    if (add) {
      next[item.id] = (next[item.id] || 0) + quantity;
      localStorage.setItem("yespiz-basket", JSON.stringify(next));
      setQuantity(0);
    }
    setBasket(next);
    dialog.current?.showModal();
  }
  return (
    <>
      <nav className="dish-toolbar">
        <ProgressiveBlur direction="top" />
        <Link href="/" className="dish-back" aria-label={t("back")}>
          ←
        </Link>
        <Button
          isIconOnly
          className="basket-trigger"
          aria-label={t("basket")}
          onPress={() => openBasket(false)}
        >
          <BasketIcon />
        </Button>
      </nav>
      <ReducedMotionConfig>
        <div className="order-anchor">
          <ProgressiveBlur direction="bottom" />
          <motion.div
            layout
            transition={morph}
            className={quantity ? "order expanded" : "order"}
          >
            <motion.div
              layout="position"
              initial={false}
              animate={{ opacity: 1 }}
              transition={swap}
              className="order-inner"
            >
              {quantity > 0 && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swap}
                    className="total"
                  >
                    <small>{t("total")}</small>
                    <strong>€{quantity * item.price}</strong>
                  </motion.div>
                  <PressButton
                    className="step"
                    aria-label={t("decrease")}
                    onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                  >
                    −
                  </PressButton>
                  <output aria-live="polite">{quantity}</output>
                  <PressButton
                    className="step plus"
                    aria-label={t("increase")}
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    +
                  </PressButton>
                </>
              )}
              <PressButton
                ref={buy}
                aria-expanded={quantity > 0}
                className="buy"
                onClick={() => (quantity ? openBasket(true) : setQuantity(1))}
              >
                {quantity ? (
                  <BasketIcon />
                ) : (
                  <span className="add-mark">＋</span>
                )}
                {t("buy")}
                {!quantity && <strong>€{item.price}</strong>}
              </PressButton>
            </motion.div>
          </motion.div>
        </div>
      </ReducedMotionConfig>
      <dialog
        className="basket-dialog"
        ref={dialog}
        aria-labelledby="basket-heading"
        onClose={() => buy.current?.focus()}
      >
        <h2 id="basket-heading">{t("basket")}</h2>
        {menu.some((entry) => basket[entry.id]) ? (
          <>
            {menu
              .filter((entry) => basket[entry.id])
              .map((entry) => (
                <p key={entry.id}>
                  {basket[entry.id]} × {t(entry.key)}{" "}
                  <b>€{basket[entry.id] * entry.price}</b>
                </p>
              ))}
            <p>
              <strong>{t("total")}</strong>
              <b>
                €
                {menu.reduce(
                  (sum, entry) => sum + (basket[entry.id] || 0) * entry.price,
                  0,
                )}
              </b>
            </p>
          </>
        ) : (
          <p>{t("empty")}</p>
        )}
        <Button onPress={() => dialog.current?.close()}>{t("close")}</Button>
      </dialog>
    </>
  );
}
