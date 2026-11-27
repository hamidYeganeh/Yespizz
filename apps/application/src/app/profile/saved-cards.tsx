"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { useLocale } from "next-intl";
import { commerceApi } from "@/lib/commerce-client";

type SavedCard = { id: string; brand: string; last4: string; exp_month: number; exp_year: number };

export function SavedCards() {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const german = useLocale().startsWith("de");
  useEffect(() => {
    let active = true;
    Promise.all([commerceApi<SavedCard[]>("me/cards"), commerceApi<{ enabled: boolean }>("integrations/payments")]).then(([list, { enabled }]) => {
      if (active) { setCards(list); setAvailable(enabled); setReady(true); }
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, []);

  async function update(id?: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (id) {
        await commerceApi(`me/cards/${encodeURIComponent(id)}`, "DELETE");
        setCards(values => values.filter(card => card.id !== id));
      } else {
        const result = await commerceApi<{ url: string | null }>("me/cards/setup", "POST", {});
        if (result.url) window.location.assign(result.url);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The request could not be completed."); }
    finally { setBusy(false); }
  }

  return <>
    {error && <p role="alert">{error}</p>}
    {ready && cards.length === 0 && <p>{german ? "Keine gespeicherten Karten" : "No saved cards"}</p>}
    <ul className="settings-list">{cards.map(card => <li className="settings-card" key={card.id}>
      <strong>{card.brand.toUpperCase()} · •••• {card.last4}</strong><small>{card.exp_month}/{card.exp_year}</small>
      <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => { if (window.confirm(german ? "Karte entfernen?" : "Remove this card?")) void update(card.id); }}>{german ? "Entfernen" : "Remove"}</Button>
    </li>)}</ul>
    {available && <Button isDisabled={busy} onPress={() => void update()}>{german ? "Karte hinzufügen" : "Add card"}</Button>}
  </>;
}
