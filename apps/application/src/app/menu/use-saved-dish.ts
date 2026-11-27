"use client";
import { useSyncExternalStore } from "react";

import { menu } from "./[id]/catalog";

function subscribeSaved(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("dish-saved", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("dish-saved", listener);
  };
}

export function useSavedDish(id: string) {
  const key = `yespiz-saved-${id}`;
  const saved = useSyncExternalStore(subscribeSaved, () => localStorage.getItem(key) === "1", () => false);
  return [saved, () => toggleSavedDish(id)] as const;
}

export function toggleSavedDish(id: string) {
    const key = `yespiz-saved-${id}`;
    if (localStorage.getItem(key) === "1") localStorage.removeItem(key);
    else localStorage.setItem(key, "1");
    window.dispatchEvent(new Event("dish-saved"));
}

function savedIds() {
  return menu.filter(({id}) => localStorage.getItem("yespiz-saved-" + id) === "1").map(({id}) => id).join(",");
}

export function useSavedDishIds() {
  const ids = useSyncExternalStore(subscribeSaved, savedIds, () => "");
  return ids ? ids.split(",") : [];
}

