"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormatter, useLocale } from "next-intl";
import { Button } from "@heroui/react";
import { commerceApi } from "@/lib/commerce-client";
import { Capacitor } from "@capacitor/core";
import { enableNativePush } from "@/lib/native-push";

type Notice = { id: string; reference: string; stage: string; at: string; read: boolean };

export function LiveNotices() {
  const [items, setItems] = useState<Notice[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [native, setNative] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const german = useLocale().startsWith("de");
  const fmt = useFormatter();
  useEffect(() => {
    setNative(Capacitor.isNativePlatform());
    let active = true;
    function load() {
      commerceApi<Notice[]>("me/notifications").then(data => {
        if (active) { setItems(data.sort((a, b) => b.at.localeCompare(a.at))); setLoadError(""); }
      }).catch(() => { if (active) setLoadError(german ? "Mitteilungen konnten nicht geladen werden." : "Could not load notifications."); });
    }
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [german]);
  return <>{native && <Button isDisabled={enabling} variant="secondary" onPress={() => {
    setEnabling(true);
    void enableNativePush().then(() => setMessage(german ? "Push-Mitteilungen aktiviert" : "Push notifications enabled"))
      .catch(error => setMessage(error.message)).finally(() => setEnabling(false));
  }}>{german ? "Push-Mitteilungen aktivieren" : "Enable push notifications"}</Button>}
    <p role="status">{loadError || message || (items && !items.length ? german ? "Keine Benachrichtigungen" : "No notifications" : "")}</p>
    <ul className="notice-list">{items?.map(item => <li className="py-4" key={item.id}>
      <Link href={`/orders/${encodeURIComponent(item.reference)}`}><strong>{item.stage.replaceAll("_", " ")}</strong><small>{item.reference}</small></Link>
      <p>{fmt.dateTime(new Date(item.at), { timeZone: "Europe/Vienna", dateStyle: "short", timeStyle: "short" })}</p>
      {!item.read && <Button size="sm" variant="secondary" onPress={() => void commerceApi(`me/notifications/${encodeURIComponent(item.id)}`, "PATCH", {})
        .then(() => setItems(previous => previous?.map(row => row.id === item.id ? { ...row, read: true } : row) ?? null))
        .catch(error => setMessage(error.message))}>{german ? "Als gelesen markieren" : "Mark as read"}</Button>}
    </li>)}</ul></>;
}
