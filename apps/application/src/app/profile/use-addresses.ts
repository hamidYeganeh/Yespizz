"use client";

import { useEffect, useState } from "react";
import { commerceApi } from "@/lib/commerce-client";
import { useProfileValue } from "./profile-data";
import type { Address } from "./address-payment";

const initialAddresses: Address[] = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1"
  ? [{ id: "demo", name: "Demo address", line: "1 Sample Street", city: "Amsterdam" }]
  : [];

export function useAddresses() {
  const [local, saveLocal, localReady] = useProfileValue<Address[]>("addresses", initialAddresses);
  const [remote, setRemote] = useState<Address[] | null>(null);
  const [ready, setReady] = useState(false);
  const offline = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1";
  useEffect(() => {
    if (offline) return;
    let active = true;
    function load() {
      commerceApi<Address[]>("me/addresses").then(value => { if (active) setRemote(value); })
        .catch(() => { if (active) setRemote(null); }).finally(() => { if (active) setReady(true); });
    }
    load();
    window.addEventListener("addresses-updated", load);
    return () => { active = false; window.removeEventListener("addresses-updated", load); };
  }, [offline]);
  async function save(address: Address) {
    if (remote) {
      await commerceApi(`me/addresses/${encodeURIComponent(address.id)}`, "PUT", address);
      setRemote(previous => [...(previous ?? []).filter(item => item.id !== address.id), address]);
      window.dispatchEvent(new Event("addresses-updated"));
    } else saveLocal([...local.filter(item => item.id !== address.id), address]);
  }
  async function remove(id: string) {
    if (remote) {
      await commerceApi(`me/addresses/${encodeURIComponent(id)}`, "DELETE");
      setRemote(previous => (previous ?? []).filter(item => item.id !== id));
      window.dispatchEvent(new Event("addresses-updated"));
    } else saveLocal(local.filter(item => item.id !== id));
  }
  return { items: remote ?? local, save, remove, ready: offline ? localReady : ready };
}
