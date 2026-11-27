"use client";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";
import { playUiSound, stopUiSound } from "../ui-sounds";
import { useProfileValue } from "./profile-data";

const initial = { general:true, sound:true, vibrate:false, special:true, discount:true, payments:true, cashback:true, updates:false, service:false, tips:false };
export function Sounds() {
  const t = useTranslations("Application.settings");
  const [values, save, ready] = useProfileValue("sounds", initial);
  return <Card className="preference-panel">{(Object.keys(initial) as (keyof typeof initial)[]).map(key =>
    <button type="button" data-own-sound="" className="sound-row justify-between" key={key} role="switch" aria-checked={values[key]} disabled={!ready} onClick={() => {
      const next = !values[key];
      save({...values,[key]:next});
      if (key === "sound") { if (next) playUiSound("select"); else stopUiSound(); }
    }}>{t(key)}<span aria-hidden="true" className="preference-track"><i /></span></button>)}</Card>;
}

export { Friends } from "./friends";
