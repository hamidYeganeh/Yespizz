"use client";

import { Button, Sheet } from "@heroui/react";
import { MapPin } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import "./profile/settings.css";
import { useEffect, useState } from "react";
import { SavedAddressRow } from "./profile/address-payment";
import { useAddresses } from "./profile/use-addresses";
import { useProfileValue } from "./profile/profile-data";
import { commerceApi } from "@/lib/commerce-client";

export function HomeAddresses() {
  const t = useTranslations("Application");
  const [open, setOpen] = useState(false);
  const { items: addresses } = useAddresses();
  const [id, select] = useProfileValue("delivery-address-id", "");
  const active = addresses.find(entry => entry.id === id) ?? addresses[0];
  const [availability, setAvailability] = useState<{ minimum: number; fee: number; etaMinutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locale = useLocale();
  const fmt = useFormatter();
  const de = locale.startsWith("de");
  const serialized = active?.postalCode ? JSON.stringify(active) : "";
  useEffect(() => {
    if (!open || !serialized || process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return;
    let current = true;
    async function check() {
      const places = await commerceApi<{ owner: string; accepting: boolean }[]>("restaurants");
      const venue = places.find(place => place.accepting);
      if (!venue) throw new Error(de ? "Derzeit ist kein Restaurant geöffnet." : "There is no restaurant accepting orders.");
      const result = await commerceApi<NonNullable<typeof availability>>("delivery/availability", "POST", { owner: venue.owner, address: JSON.parse(serialized) });
      if (current) { setAvailability(result); setError(""); }
    }
    void check().catch(failure => { if (current) { setAvailability(null); setError(failure.message); } })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [open, serialized, de]);
  const money = (cents: number) => fmt.number(cents / 100, { style: "currency", currency: "EUR" });
  return <><Button size="sm" variant="secondary" className="min-w-0 rounded-full" onPress={() => { setBusy(Boolean(serialized) && process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1"); setOpen(true); }}>
    <MapPin size={14}/><span className="truncate">{active?.name ?? t("checkout.selectAddress")}</span></Button>
    <Sheet placement="bottom" isOpen={open} onOpenChange={value => { setOpen(value); setError(""); setAvailability(null); }}><Sheet.Backdrop><Sheet.Content className="mx-auto max-w-(--app-width)"><Sheet.Dialog>
      <Sheet.Handle/><Sheet.CloseTrigger/><Sheet.Header><Sheet.Heading>{t("checkout.selectAddress")}</Sheet.Heading></Sheet.Header>
      <Sheet.Body style={{paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}} className="saved-address-list settings-list overflow-y-auto" data-lenis-prevent>{addresses.length ? addresses.map(entry =>
        <SavedAddressRow key={entry.id} item={entry} selected={active?.id === entry.id} onPress={() => {
          if (entry.id === active?.id) return;
          select(entry.id); setAvailability(null); setError(""); setBusy(Boolean(entry.postalCode) && process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1");
        }} />) : t("settings.emptyAddress")}
        {busy && <p role="status">{de ? "Adresse wird geprüft …" : "Checking address…"}</p>}
        {availability && <p>{de ? "Lieferung" : "Delivery"} {money(availability.fee)} · {de ? "Mindestbestellwert" : "Minimum"} {money(availability.minimum)} · {availability.etaMinutes} min</p>}
        {error && <p role="alert">{error}</p>}</Sheet.Body>
    </Sheet.Dialog></Sheet.Content></Sheet.Backdrop></Sheet></>;
}
