"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@heroui/react";
import { useFormatter, useLocale } from "next-intl";
import { addConfiguredLine } from "../../payment/cart";
import { useLiveCatalog, type LiveItem } from "../live-catalog";

export function CustomizeDish({ id, fallback }: { id: string; fallback?: boolean }) {
  const entries = useLiveCatalog();
  const item = entries?.find(entry => entry.id === id);
  if (!item) return fallback ? <Card className="checkout-card"><Card.Content><Link href="/menu">Menu</Link><p>{entries ? "Item unavailable." : "Loading item…"}</p></Card.Content></Card> : null;
  return <DishOptions item={item} standalone={Boolean(fallback)} />;
}

function DishOptions({ item, standalone }: { item: LiveItem; standalone: boolean }) {
  const [size, setSize] = useState("");
  const [toppings, setToppings] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("1");
  const fmt = useFormatter();
  const de = useLocale().startsWith("de");
  const router = useRouter();
  const price = (item.sizes.find(value => value.id === size)?.price ?? item.price) + item.addOns.reduce((sum, extra) => sum + (toppings.includes(extra.id) ? extra.price : 0), 0);
  const money = (cents: number) => fmt.number(cents / 100, { style: "currency", currency: "EUR" });
  function toggle(values: string[], value: string) { return values.includes(value) ? values.filter(current => current !== value) : [...values, value]; }
  if (!standalone && item.available && !item.allergens.length && !item.sizes.length && !item.addOns.length && !item.removable.length) return null;
  return <Card className="checkout-card"><Card.Content>
    {standalone && <><Link href="/menu">Menu</Link><h1>{item.name ?? item.id}</h1><p>{item.ingredients.join(", ")}</p></>}
    {item.allergens.length > 0 && <p>{de ? "Allergene" : "Allergens"} · {item.allergens.join(", ")}</p>}
    {item.available ? <form onSubmit={event => {
      event.preventDefault();
      const count = Number(quantity);
      if (!Number.isInteger(count) || count < 1 || count > 20) return;
      addConfiguredLine({ id: item.id, name: item.name ?? item.id, quantity: count, unitPrice: price, size: size || undefined, toppings, removed });
      router.push("/payment");
    }}>
      {item.sizes.length > 0 && <label>{de ? "Größe" : "Size"}<select value={size} onChange={event => setSize(event.target.value)}><option value="">{de ? "Standard" : "Regular"}</option>{item.sizes.map(entry => <option key={entry.id} value={entry.id}>{entry.id} · {money(entry.price)}</option>)}</select></label>}
      {item.addOns.map(extra => <label key={extra.id}><input type="checkbox" checked={toppings.includes(extra.id)} onChange={() => setToppings(toggle(toppings, extra.id))} /> {extra.name ?? extra.id} +{money(extra.price)}</label>)}
      {item.removable.map(ingredient => <label key={ingredient}><input type="checkbox" checked={removed.includes(ingredient)} onChange={() => setRemoved(toggle(removed, ingredient))} /> {de ? "Ohne" : "Remove"} {ingredient}</label>)}
      <label>{de ? "Menge" : "Quantity"}<Input type="number" min={1} max={20} required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <Button type="submit">{de ? "In den Warenkorb" : "Add to basket"} · {money(price * Number(quantity || 1))}</Button>
    </form> : <p>{de ? "Derzeit nicht verfügbar" : "Currently unavailable"}</p>}
  </Card.Content></Card>;
}
