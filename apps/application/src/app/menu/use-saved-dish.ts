"use client";
import { useEffect, useSyncExternalStore } from "react";

import { menu } from "./[id]/catalog";
import { commerceApi } from "@/lib/commerce-client";

let remote: Set<string> | undefined;
let pending: Promise<void> | undefined;
let refreshed = 0;
function load() {
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1" || pending || Date.now() - refreshed < 10000) return;
  pending = commerceApi<{ id: string }[]>("me/favorites").then(items => { remote = new Set(items.map(item => item.id)); })
    .catch(() => { remote = undefined; }).finally(() => {
      pending = undefined; refreshed = Date.now(); window.dispatchEvent(new Event("dish-saved"));
    });
}

function subscribeSaved(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("dish-saved", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("dish-saved", listener);
  };
}

export function useSavedDish(id: string) {
  useEffect(load, []);
  const key = `yespiz-saved-${id}`;
  const saved = useSyncExternalStore(subscribeSaved, () => remote?.has(id) ?? localStorage.getItem(key) === "1", () => false);
  return [saved, () => toggleSavedDish(id)] as const;
}

export function toggleSavedDish(id: string) {
    if (remote) {
      const saved = remote.has(id);
      void commerceApi(`me/favorites/${encodeURIComponent(id)}`, saved ? "DELETE" : "PUT", {}).then(() => {
        if (saved) remote?.delete(id); else remote?.add(id);
        window.dispatchEvent(new Event("dish-saved"));
      }).catch(() => {});
      return;
    }
    const key = `yespiz-saved-${id}`;
    if (localStorage.getItem(key) === "1") localStorage.removeItem(key);
    else localStorage.setItem(key, "1");
    window.dispatchEvent(new Event("dish-saved"));
}

function savedIds() {
  return remote ? Array.from(remote).join(",") : menu.filter(({id}) => localStorage.getItem("yespiz-saved-" + id) === "1").map(({id}) => id).join(",");
}

export function useSavedDishIds() {
  useEffect(load, []);
  const ids = useSyncExternalStore(subscribeSaved, savedIds, () => "");
  return ids ? ids.split(",") : [];
}

