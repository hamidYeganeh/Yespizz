"use client";

import { useEffect } from "react";
import { commerceApi } from "@/lib/commerce-client";
import { configuredBasketKey } from "./cart";

const simpleKey = "yespiz-basket";
type SavedCart = { simple: Record<string, number>; configured: unknown[] };

export function useCartSync(online: boolean) {
  useEffect(() => {
    if (!online) return;
    let active = true;
    let signedIn = false;
    let lastSynced = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    function read(): SavedCart {
      try { return { simple: JSON.parse(localStorage.getItem(simpleKey) ?? "{}"), configured: JSON.parse(localStorage.getItem(configuredBasketKey) ?? "[]") }; }
      catch { return { simple: {}, configured: [] }; }
    }
    function sync() {
      if (!signedIn || !active) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const value = read();
        const key = JSON.stringify(value);
        if (key === lastSynced) return;
        void commerceApi("me/cart", "PUT", { value }).then(() => { lastSynced = key; }).catch(() => {});
      }, 250);
    }
    commerceApi<{ value?: SavedCart } | null>("me/cart").then(result => {
      if (!active) return;
      signedIn = true;
      const local = read();
      const remote = result?.value;
      if (remote && !Object.values(local.simple).some(quantity => quantity > 0) && !local.configured.length) {
        localStorage.setItem(simpleKey, JSON.stringify(remote.simple));
        localStorage.setItem(configuredBasketKey, JSON.stringify(remote.configured));
        lastSynced = JSON.stringify(remote);
        window.dispatchEvent(new Event("storage"));
      }
      sync();
    }).catch(() => {});
    window.addEventListener("storage", sync);
    return () => { active = false; clearTimeout(timer); window.removeEventListener("storage", sync); };
  }, [online]);
}
