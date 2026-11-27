"use client";
import { Button, Input } from "@heroui/react";
import { Icon } from "@repo/icons";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";
import { useProfileValue } from "./profile-data";

import { CardSheet } from "../../components/ui/card-sheet";
import { AddressMap, type Point } from "./address-map";
import { useAddresses } from "./use-addresses";
import { commerceApi } from "@/lib/commerce-client";
import { SavedCards } from "./saved-cards";

const addressFields = ["unit", "city", "region", "postalCode", "country", "deliveryNotes"] as const;
export type Address = { id: string; name: string; line: string; point?: Point } & Partial<Record<typeof addressFields[number], string>>;

export function AddressForm({initial, onSave, inSheet = false}: {initial: Address; onSave: (address: Address) => void; inSheet?: boolean}) {
  const t = useTranslations("Application.settings");
  const [editing, edit] = useState(initial);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; text: string }[]>([]);
  const [streetQuery, setStreetQuery] = useState("");
  const request = useRef<AbortController | null>(null);
  const autoFilled = useRef<Record<string,string>>({});
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1" || streetQuery.trim().length < 3) return;
    let active = true;
    const timer = setTimeout(() => void commerceApi<typeof suggestions>("locations/suggestions", "POST", { query: streetQuery }).then(data => {
      if (active) setSuggestions(data);
    }).catch(() => { if (active) setSuggestions([]); }), 350);
    return () => { active = false; clearTimeout(timer); };
  }, [streetQuery]);
  async function selectPoint(point: Point) {
    request.current?.abort();
    setLookupFailed(false);
    const controller = new AbortController();
    request.current = controller;
    edit(current => ({...current, point}));
    try {
      const params = new URLSearchParams({format:"jsonv2",lat:String(point.lat),lon:String(point.lng),addressdetails:"1"});
      const response = await fetch("https://nominatim.openstreetmap.org/reverse?" + params, {signal:controller.signal});
      if (!response.ok) throw new Error("Address lookup failed");
      const {address} = await response.json();
      if (controller.signal.aborted) return;
      if (!address) throw new Error("Missing address");
      const road = address.road || address.pedestrian || address.footway || "";
      const fields = {
        name: address.amenity || address.building || road || address.village || address.city,
        line: [road,address.house_number].filter(Boolean).join(" "),
        city: address.city || address.town || address.village || address.municipality,
        region: address.state || address.province, postalCode:address.postcode, country:address.country,
      };
      const previous = autoFilled.current;
      autoFilled.current = fields;
      edit(current => {
        if (current.point !== point) return current;
        const next = {...current};
        for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
          if (fields[key] && (!current[key]?.trim() || current[key] === previous[key])) next[key] = fields[key];
        }
        return next;
      });
    } catch {
      if (!controller.signal.aborted) setLookupFailed(true);
    }
  }
  return <form className="settings-form" onSubmit={event => { event.preventDefault(); onSave(editing); }}>
    <label>{t("addressName")}<Input required autoFocus value={editing.name} onChange={e => edit({...editing,name:e.target.value})} /></label>
    <label>{t("street")}<Input required value={editing.line} onChange={e => { edit({ ...editing, line: e.target.value }); setStreetQuery(e.target.value); setSuggestions([]); }} /></label>
    {suggestions.length > 0 && <ul>{suggestions.map(result => <li key={result.id}><button type="button" onClick={() => {
      setStreetQuery(""); setSuggestions([]);
      void commerceApi<Partial<Address>>(`locations/places/${encodeURIComponent(result.id)}`).then(data => edit(current => ({ ...current, ...data }))).catch(() => setLookupFailed(true));
    }}>{result.text}</button></li>)}</ul>}
    {addressFields.map(key => <label key={key}>{t(key)}<Input required={process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1" && (key === "city" || key === "postalCode")} value={editing[key] ?? ""} onChange={e => edit({...editing,[key]:e.target.value})} /></label>)}
    {process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1" && <AddressMap point={editing.point} onSelect={selectPoint}/>}
    {lookupFailed && <p role="status">{t("pinLookupFailed")}</p>}
    <footer className={inSheet ? undefined : "settings-action"}><Button type="submit" isDisabled={!editing.name.trim() || !editing.line.trim()}>{t("save")}</Button></footer>
  </form>;
}
export function addressLine(item: Address) {
  return [item.line, item.unit, item.city, item.postalCode, item.country].filter(Boolean).join(", ");
}

export function SavedAddressRow({ item, onPress, selected }: { item: Address; onPress: () => void; selected?: boolean }) {
  return <button type="button" className="settings-card" onClick={onPress} aria-pressed={selected}>
    <span className="setting-icon"><Icon name="map-pin-1" /></span>
    <span className="min-w-0 grow text-start"><strong>{item.name}</strong><small>{addressLine(item)}</small></span>
    <Icon name={selected ? "check" : "chevron-right"} />
  </button>;
}

export function AddressBook() {
  const t = useTranslations("Application.settings");
  const { items, save, remove, ready } = useAddresses();
  const [editing, edit] = useState<Address | null>(null);
  const [error, setError] = useState("");
  if (editing) return <>{error && <p role="alert">{error}</p>}<AddressForm initial={editing} onSave={address => {
    void save(address).then(() => { setError(""); edit(null); }).catch(failure => setError(failure.message));
  }} />{items.some(entry => entry.id === editing.id) && <Button variant="danger" onPress={() => void remove(editing.id).then(() => edit(null)).catch(failure => setError(failure.message))}>Delete address</Button>}</>;

  return <><ul className="settings-list">{items.map(item => <li key={item.id}><SavedAddressRow item={item} onPress={() => edit(item)} /></li>)}</ul>
    {ready && !items.length && <div className="settings-empty"><img className="empty-art" src="/empty/address.webp" alt="" /><h2>{t("emptyAddress")}</h2><p>{t("addressHint")}</p></div>}
    <footer className="settings-action"><Button isDisabled={!ready} onPress={() => edit({id:crypto.randomUUID(),name:"",line:""})}>{t("addAddress")}</Button></footer></>;
}

export const wallets = ["Klarna", "Google Pay", "Apple Pay", "Stripe", "PayPal"];
export const defaultCards = ["8395","4679","2766","3892"];
export function Payments() {
  return process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1" ? <DemoPayments /> : <SavedCards />;
}

function DemoPayments() {
  const t = useTranslations("Application.settings");
  const [cards, save, ready] = useProfileValue<string[]>("cards", defaultCards);
  const [adding, setAdding] = useState(false);
  return <><ul className="settings-list">{[...wallets,...cards].map((value,i) => <li className="settings-card" key={i}>
    {["Google Pay","Apple Pay","PayPal"].includes(value)?<img className="payment-mark" alt="" src={"/profile/"+({"Google Pay":"google","Apple Pay":"apple","PayPal":"paypal"}[value])+".png"}/>:value==="Klarna"||value==="Stripe"?<span aria-hidden className="rounded-lg px-2 py-1 font-black" style={{background:value==="Klarna"?"#ffb3c7":"#635bff",color:value==="Klarna"?"black":"white"}}>{value==="Klarna"?"K.":"stripe"}</span>:<Icon name="credit-card"/>}<strong>{i < wallets.length ? value : "•••• " + value}</strong>
  </li>)}</ul><footer className="settings-action"><Button isDisabled={!ready} onPress={() => setAdding(true)}>{t("addCard")}</Button></footer>
    <CardSheet open={adding} close={()=>setAdding(false)} save={lastFour => save([...new Set([...cards,lastFour])])}/></>;
}
