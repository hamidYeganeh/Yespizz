"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, TextArea } from "@heroui/react";
import { useLocale } from "next-intl";
import { commerceApi } from "@/lib/commerce-client";

type Review = { rating: number; text: string; published: boolean };
export function OrderReviewForm() {
  const query = useSearchParams();
  const de = useLocale().startsWith("de");
  const order = query.get("order") ?? "";
  const token = query.get("access");
  const suffix = token ? "?access=" + encodeURIComponent(token) : "";
  const orderPath = "orders/" + encodeURIComponent(order);
  const api = orderPath + "/review" + suffix;
  const [rating, rate] = useState(0);
  const [text, write] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, fail] = useState("");
  useEffect(() => {
    let current = true;
    setReady(false); setSaved(false); fail("");
    commerceApi<Review | null>(api).then(review => {
      if (current) { rate(review?.rating ?? 0); write(review?.text ?? ""); setReady(true); }
    }).catch(e => { if (current) fail(e.message); });
    return () => { current = false; };
  }, [api]);
  return <main className="checkout order-receipt review-form"><header><Link href={"/" + orderPath + suffix}>{de ? "Bestellung" : "Order details"}</Link></header>
    <Card className="checkout-card"><Card.Content><h1>{de ? "Bestellung bewerten" : "Review your order"}</h1>
      <small className="receipt-reference">{order}</small>
      {error && <p role="alert">{error}</p>}
      {!ready && !error && <p role="status">{de ? "Wird geladen …" : "Loading…"}</p>}
      {ready && <form onSubmit={async e => {
        e.preventDefault(); setBusy(true); fail(""); setSaved(false);
        try { await commerceApi(api, "POST", { rating, text: text.trim() }); setSaved(true); }
        catch (e) { fail(e instanceof Error ? e.message : "Could not save review."); }
        finally { setBusy(false); }
      }} onChange={() => setSaved(false)}>
        <fieldset><legend>{de ? "Deine Bewertung" : "Your rating"}</legend><div className="review-stars">
          {[1,2,3,4,5].map(n => <label key={n} data-lit={n <= rating}><input type="radio" name="rating" required checked={rating === n} onChange={() => rate(n)} aria-label={n + (de ? " von 5" : " out of 5")}/><span aria-hidden="true">★</span></label>)}
        </div></fieldset>
        <label>{de ? "Dein Kommentar" : "Your review"}<TextArea rows={4} required maxLength={2000} value={text} onChange={e => write(e.target.value)}/></label>
        <Button type="submit" isDisabled={busy || !rating || !text.trim()}>{de ? "Bewertung speichern" : "Save review"}</Button>
        {saved && <p role="status">{de ? "Gespeichert. Deine Bewertung wird vor der Veröffentlichung geprüft." : "Review saved. It will appear on the menu after approval."}</p>}
      </form>}
    </Card.Content></Card></main>;
}
