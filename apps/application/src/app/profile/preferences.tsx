"use client";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";
import { playUiSound, stopUiSound } from "../ui-sounds";
import { useProfileValue } from "./profile-data";
import { useEffect, useState } from "react";
import { commerceApi } from "@/lib/commerce-client";

const initial = { general:true, sound:true, vibrate:false, special:true, discount:true, payments:true, cashback:true, updates:false, service:false, tips:false };
export function Sounds() {
  const t = useTranslations("Application.settings");
  const [values, save, ready] = useProfileValue("sounds", initial);
  const [remote, setRemote] = useState<Partial<typeof initial> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return;
    let live = true;
    commerceApi<{ value?: Partial<typeof initial> } | null>("me/preferences/sounds").then(data => {
      if (live) { setSignedIn(true); setRemote(data?.value ?? null); }
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const current = remote ? { ...initial, ...remote } : values;
  return <Card className="preference-panel">{(Object.keys(initial) as (keyof typeof initial)[]).map(key =>
    <button type="button" data-own-sound="" className="sound-row justify-between" key={key} role="switch" aria-checked={current[key]} disabled={!ready} onClick={() => {
      const next = !current[key];
      const updated = { ...current, [key]: next };
      save(updated);
      if (signedIn) { setRemote(updated); void commerceApi("me/preferences/sounds", "PUT", { value: updated }).catch(() => {}); }
      if (key === "sound") { if (next) playUiSound("select"); else stopUiSound(); }
    }}>{t(key)}<span aria-hidden="true" className="preference-track"><i /></span></button>)}</Card>;
}

export { Friends } from "./friends";
