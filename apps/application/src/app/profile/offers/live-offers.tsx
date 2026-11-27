"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale } from "next-intl";
import Link from "next/link";
import { Card } from "@heroui/react";
import { commerceApi } from "@/lib/commerce-client";
import { SelectOffer } from "./select-offer";

type Offer = { id: string; code: string; amount: number; minimum: number; name?: string };

export function LiveOffers({ offerId }: { offerId?: string }) {
  const parameters = useSearchParams();
  const choosing = parameters.get("from") === "checkout";
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const german = useLocale().startsWith("de");
  const format = useFormatter();
  useEffect(() => {
    let mounted = true;
    commerceApi<Offer[]>("offers").then(items => { if (mounted) setOffers(items); }).catch(() => { if (mounted) setOffers([]); });
    return () => { mounted = false; };
  }, []);
  const items = offers?.filter(offer => !offerId || offer.id === offerId);
  const money = (value: number) => format.number(value / 100, { style: "currency", currency: "EUR" });
  return <main className="offer-page offer-index">
    <header className="ticket-header"><Link aria-label={german ? "Zurück" : "Back"} href={choosing ? "/payment?offerSheet=1" : offerId ? "/profile/offers" : "/profile"}>‹</Link><h1>{german ? "Angebote" : "Offers"}</h1></header>
    {items?.length === 0 && <p className="offer-empty">{german ? "Derzeit keine Angebote." : "No offers available."}</p>}
    <ul className="offer-list">{items?.map(offer => {
      const card = <Card className="offer-stub"><Card.Content className="ticket-identity"><div><h2>{offer.name || money(offer.amount)}</h2>
        <p>{money(offer.amount)} {german ? "Rabatt" : "off"}{Boolean(offer.minimum) && ` · ${german ? "ab" : "minimum"} ${money(offer.minimum)}`}</p>
        {offerId && <p>{offer.code}</p>}</div></Card.Content></Card>;
      return <li key={offer.id}>{choosing ? <SelectOffer code={offer.code}>{card}</SelectOffer> : offerId ? card : <Link href={`/profile/offers/${encodeURIComponent(offer.id)}`}>{card}</Link>}</li>;
    })}</ul>
  </main>;
}
