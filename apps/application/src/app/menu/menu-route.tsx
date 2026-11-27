"use client";

import { useSearchParams } from "next/navigation";
import { MenuBrowser } from "./menu-browser";

export function MenuRoute() {
  const query = useSearchParams();
  const category = query.get("category");
  return <MenuBrowser key={query.toString()} openSearch={query.get("search") === "true"}
    recommended={query.get("recommended") === "true"} initialQuery={query.get("q")?.trim() ?? ""}
    promo={query.get("promo") === "true"} category={category === "dessert" || category === "beverages" ? category : ""} />;
}
