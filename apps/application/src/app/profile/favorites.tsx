"use client";

import { MenuCard } from "../menu/menu-card";
import { useTranslations } from "next-intl";
import { ButtonLink } from "../components/button-link";
import { menu } from "../menu/[id]/catalog";
import { useSavedDishIds } from "../menu/use-saved-dish";

export function Favorites() {
  const saved = useSavedDishIds();
  const t = useTranslations("Application.profile");
  const checkout = useTranslations("Application.checkout");
  if (!saved.length) return <div className="list-empty"><img src="/empty/favorites.webp" alt="" /><p>{t("detail.favorites")}</p><ButtonLink href="/menu">{checkout("menu")}</ButtonLink></div>;
  return <ul>{menu.filter(item => saved.includes(item.id)).map(item =>
    <li key={item.id}><MenuCard item={item} /></li>)}</ul>;
}
