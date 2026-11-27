"use client";

import { Button, Sheet } from "@heroui/react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import "./profile/settings.css";
import { useState } from "react";
import { initialAddresses, SavedAddressRow, type Address } from "./profile/address-payment";
import { useProfileValue } from "./profile/profile-data";

export function HomeAddresses() {
  const t = useTranslations("Application");
  const [open, setOpen] = useState(false);
  const [addresses] = useProfileValue<Address[]>("addresses", initialAddresses);
  const [id, select] = useProfileValue("delivery-address-id", "");
  const active = addresses.find(entry => entry.id === id) ?? addresses[0];
  return <><Button size="sm" variant="secondary" className="min-w-0 rounded-full" onPress={() => setOpen(true)}>
    <MapPin size={14}/><span className="truncate">{active?.name ?? t("checkout.selectAddress")}</span></Button>
    <Sheet placement="bottom" isOpen={open} onOpenChange={setOpen}><Sheet.Backdrop><Sheet.Content className="mx-auto max-w-(--app-width)"><Sheet.Dialog>
      <Sheet.Handle/><Sheet.CloseTrigger/><Sheet.Header><Sheet.Heading>{t("checkout.selectAddress")}</Sheet.Heading></Sheet.Header>
      <Sheet.Body style={{paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}} className="saved-address-list settings-list overflow-y-auto" data-lenis-prevent>{addresses.length ? addresses.map(entry =>
        <SavedAddressRow key={entry.id} item={entry} selected={active?.id === entry.id} onPress={() => { select(entry.id); setOpen(false); }} />) : t("settings.emptyAddress")}</Sheet.Body>
    </Sheet.Dialog></Sheet.Content></Sheet.Backdrop></Sheet></>;
}
