"use client";

import { useEffect, useState } from "react";
import { commerceApi } from "@/lib/commerce-client";

export type LiveItem = { id: string; name?: string; price: number; available: boolean; image?: string; ingredients: string[]; allergens: string[];
  category?: string; rating: number; ratingCount: number;
  sizes: { id: string; price: number }[]; addOns: { id: string; name?: string; price: number }[]; removable: string[] };

export function useLiveCatalog() {
  const [items, setItems] = useState<LiveItem[] | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return;
    let live = true;
    async function load() {
      const venues = await commerceApi<{ owner: string; accepting: boolean }[]>("restaurants");
      const venue = venues.find(item => item.accepting) ?? venues[0];
      if (venue) {
        const value = await commerceApi<LiveItem[]>(`restaurants/${encodeURIComponent(venue.owner)}/menu`);
        if (live) setItems(value);
      }
    }
    void load().catch(() => {});
    return () => { live = false; };
  }, []);
  return items;
}
